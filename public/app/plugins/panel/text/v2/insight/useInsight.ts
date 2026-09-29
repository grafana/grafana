import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';

import { SceneObjectStateChangedEvent } from '@grafana/scenes';
import { type DashboardSceneLike } from 'app/features/dashboard-scene/scene/types/dashboard';
import { parseInsightAnswer } from 'app/features/dashboard-scene/sidebar/insights/answer';
import { askInsightAssistant } from 'app/features/dashboard-scene/sidebar/insights/askAssistant';
import { captureInsightSnapshot } from 'app/features/dashboard-scene/sidebar/insights/snapshot';
import {
  getInsightSourcePanels,
  loadInsightSources,
  type InsightSourcePanel,
} from 'app/features/dashboard-scene/sidebar/insights/sources';
import { getInsightStaleReasons } from 'app/features/dashboard-scene/sidebar/insights/staleness';
import { type InsightQuestion, type InsightResult } from 'app/features/dashboard-scene/sidebar/insights/types';

import { type InsightOptions } from '../../panelcfg.gen';

import { buildFollowUpSystemPrompt } from './followUpPrompt';

/** Panel data, time range, and variable changes are what make an answer out of date. */
const RERENDER_KEYS = ['data', 'value', 'text', 'filters'];

/** One author-defined follow-up and its own answer, threaded under the main answer. */
export interface FollowUpThread {
  question: string;
  running: boolean;
  result?: InsightResult;
  error?: string;
}

export interface InsightState {
  /** The main question's answer, if it has been asked. */
  result?: InsightResult;
  running: boolean;
  /** Off-screen sources are loading before the question is sent. */
  loadingSources: boolean;
  error?: string;
  /** Why the main answer no longer matches the dashboard; empty when it still does. */
  staleReasons: string[];
  /** Why the sources cannot be captured right now, which blocks asking. */
  unavailable?: string;
  sources: InsightSourcePanel[];
  followUps: FollowUpThread[];
  ask: () => void;
  askFollowUp: (question: string) => void;
}

function toQuestion(options: InsightOptions): InsightQuestion {
  return {
    // Insight mode has one question per panel, so a stable literal is enough.
    id: 'panel-insight',
    question: options.question ?? '',
    sourcePanelKeys: options.sourcePanelKeys ?? [],
  };
}

/**
 * Owns a single panel's insight session: the main answer, one thread per author-defined follow-up,
 * and the observation that marks an answer out of date. Answers are session-local and never saved
 * into panel options. Nothing here runs a query or a model request on its own — the viewer asks.
 */
export function useInsight(dashboard: DashboardSceneLike | undefined, options: InsightOptions): InsightState {
  const [result, setResult] = useState<InsightResult>();
  const [running, setRunning] = useState(false);
  const [loadingSources, setLoadingSources] = useState(false);
  const [error, setError] = useState<string>();
  const [threads, setThreads] = useState<Record<string, FollowUpThread>>({});

  // Staleness and source availability derive from live panel data, so re-read them when the
  // dashboard changes. Coalesced to one render per frame: a refresh touches many panels at once.
  const [observed, observe] = useReducer((value: number) => value + 1, 0);
  const pending = useRef<AbortController | undefined>(undefined);
  const followUpPending = useRef(new Map<string, AbortController>());

  useEffect(() => {
    if (!dashboard) {
      return;
    }
    let frame: number | undefined;
    const sub = dashboard.subscribeToEvent(SceneObjectStateChangedEvent, ({ payload }) => {
      const update = payload.partialUpdate;
      if (!RERENDER_KEYS.some((key) => key in update) || frame !== undefined) {
        return;
      }
      frame = requestAnimationFrame(() => {
        frame = undefined;
        observe();
      });
    });
    return () => {
      sub.unsubscribe();
      if (frame !== undefined) {
        cancelAnimationFrame(frame);
      }
    };
  }, [dashboard]);

  // Abort in-flight requests when the panel unmounts, so a completed answer never
  // lands on an unmounted component and the request does not outlive the panel.
  useEffect(
    () => () => {
      pending.current?.abort();
      for (const controller of followUpPending.current.values()) {
        controller.abort();
      }
      followUpPending.current.clear();
    },
    []
  );

  const question = toQuestion(options);
  const questionKey = `${question.question}|${question.sourcePanelKeys.join(',')}`;

  // `observed` is the dependency that re-captures against current data; the snapshot itself
  // is only used to detect staleness and refusals here, never sent from this memo.
  const capture = useMemo(
    () => (dashboard ? captureInsightSnapshot(dashboard, question) : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dashboard, questionKey, observed]
  );

  const sources = useMemo(
    () => (dashboard ? getInsightSourcePanels(dashboard) : []),
    // `observed` re-reads the panel list after a layout or data change; the callback does not use it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dashboard, observed]
  );

  const ask = useCallback(async () => {
    if (!dashboard || pending.current) {
      return;
    }

    const initial = captureInsightSnapshot(dashboard, question);
    // An unloaded source is not a refusal: asking loads it first.
    if (!initial.snapshot && !initial.unloaded) {
      setError(initial.unavailable);
      return;
    }

    const controller = new AbortController();
    pending.current = controller;
    setRunning(true);
    setError(undefined);

    try {
      const selected = getInsightSourcePanels(dashboard).filter((source) => initial.keys.includes(source.key));
      const loading = loadInsightSources(selected, controller.signal);
      if (loading) {
        setLoadingSources(true);
        await loading;
        if (controller.signal.aborted) {
          return;
        }
        setLoadingSources(false);
      }

      const { snapshot, unavailable } = loading ? captureInsightSnapshot(dashboard, question) : initial;
      if (!snapshot) {
        throw new Error(unavailable);
      }

      const content = parseInsightAnswer(await askInsightAssistant(snapshot, controller.signal));
      if (controller.signal.aborted) {
        return;
      }
      setResult({
        content,
        snapshot,
        completedAt: new Date().toISOString(),
        sourceLocation: window.location.href,
      });
      // A new main answer invalidates the follow-up thread it was answered against.
      setThreads({});
    } catch (failure) {
      if (!controller.signal.aborted) {
        setError(failure instanceof Error ? failure.message : String(failure));
      }
    } finally {
      if (pending.current === controller) {
        pending.current = undefined;
      }
      if (!controller.signal.aborted) {
        setRunning(false);
        setLoadingSources(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dashboard, questionKey]);

  const patchThread = useCallback((followUp: string, patch: Partial<FollowUpThread>) => {
    setThreads((current) => {
      const previous = current[followUp] ?? { question: followUp, running: false };
      return { ...current, [followUp]: { ...previous, ...patch } };
    });
  }, []);

  const askFollowUp = useCallback(
    async (followUp: string) => {
      // A follow-up answers against the snapshot the main answer used, so the thread stays
      // consistent: no re-capture, no source loading, and no new data mid-conversation.
      if (!result || followUpPending.current.has(followUp)) {
        return;
      }

      const controller = new AbortController();
      followUpPending.current.set(followUp, controller);
      patchThread(followUp, { running: true, error: undefined });

      try {
        const snapshot = { ...result.snapshot, question: followUp };
        const text = await askInsightAssistant(
          snapshot,
          controller.signal,
          buildFollowUpSystemPrompt(result.snapshot.question, result.content)
        );
        if (controller.signal.aborted) {
          return;
        }
        patchThread(followUp, {
          result: {
            content: parseInsightAnswer(text),
            snapshot,
            completedAt: new Date().toISOString(),
            sourceLocation: window.location.href,
          },
          error: undefined,
        });
      } catch (failure) {
        if (!controller.signal.aborted) {
          patchThread(followUp, { error: failure instanceof Error ? failure.message : String(failure) });
        }
      } finally {
        if (followUpPending.current.get(followUp) === controller) {
          followUpPending.current.delete(followUp);
        }
        if (!controller.signal.aborted) {
          patchThread(followUp, { running: false });
        }
      }
    },
    [result, patchThread]
  );

  const staleReasons = useMemo(
    () =>
      result && capture ? getInsightStaleReasons(result.snapshot, capture.context, capture.keys, capture.snapshot) : [],
    [result, capture]
  );

  const followUps = useMemo(
    () =>
      (options.followUps ?? [])
        .map((followUp) => followUp.trim())
        .filter(Boolean)
        .map((followUp) => threads[followUp] ?? { question: followUp, running: false }),
    [options.followUps, threads]
  );

  return {
    result,
    running,
    loadingSources,
    error,
    staleReasons,
    unavailable: capture?.unavailable,
    sources,
    followUps,
    ask,
    askFollowUp,
  };
}
