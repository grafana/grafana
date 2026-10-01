import { useEffect, useMemo, useReducer, useSyncExternalStore } from 'react';

import { SceneObjectStateChangedEvent } from '@grafana/scenes';
import { type DashboardSceneLike } from 'app/features/dashboard-scene/scene/types/dashboard';
import { getRunningInvestigationId } from 'app/features/dashboard-scene/sidebar/insights/investigation';
import { canShareInsightAnswers } from 'app/features/dashboard-scene/sidebar/insights/sharedAnswers';
import { captureInsightSnapshot } from 'app/features/dashboard-scene/sidebar/insights/snapshot';
import { getInsightSourcePanels, type InsightSourcePanel } from 'app/features/dashboard-scene/sidebar/insights/sources';
import { getInsightStaleReasons } from 'app/features/dashboard-scene/sidebar/insights/staleness';
import { type InsightInvestigation, type InsightResult } from 'app/features/dashboard-scene/sidebar/insights/types';

import { type InsightOptions } from '../../panelcfg.gen';

import {
  EMPTY_INSIGHT_SESSION,
  getInsightSessions,
  type InsightAskQuestion,
  type InsightFollowUpThread,
} from './insightSessions';

/** Panel data, time range, and variable changes are what make an answer out of date. */
const RERENDER_KEYS = ['data', 'value', 'text', 'filters'];

const INVESTIGATION_POLL_MS = 15_000;

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
  followUps: InsightFollowUpThread[];
  sharing: boolean;
  shareError?: string;
  /** The viewer may make an answer the one everyone who opens the dashboard sees. */
  canShare: boolean;
  investigation?: InsightInvestigation;
  /** Starting another investigation would fail the same way, so the action is hidden. */
  investigationsUnavailable: boolean;
  ask: () => void;
  askFollowUp: (question: string) => void;
  share: () => void;
  investigate: () => void;
}

const subscribeToNothing = () => () => {};

/**
 * One insight as the viewer sees it: its session, the author-defined follow-ups, and the observation that
 * marks an answer out of date. `id` picks the session, which lives on the dashboard so the Insight panel and
 * its sidebar entry show the same answer.
 */
export function useInsight(
  dashboard: DashboardSceneLike | undefined,
  id: string,
  options: InsightOptions
): InsightState {
  const sessions = dashboard ? getInsightSessions(dashboard) : undefined;
  const session = useSyncExternalStore(
    sessions?.subscribe ?? subscribeToNothing,
    () => sessions?.get(id) ?? EMPTY_INSIGHT_SESSION
  );
  const investigationsUnavailable = useSyncExternalStore(
    sessions?.subscribe ?? subscribeToNothing,
    () => sessions?.areInvestigationsUnavailable() ?? false
  );

  // Staleness and source availability derive from live panel data, so re-read them when the
  // dashboard changes. Coalesced to one render per frame: a refresh touches many panels at once.
  const [observed, observe] = useReducer((value: number) => value + 1, 0);

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

  useEffect(() => {
    sessions?.loadShared();
  }, [sessions]);

  const runningInvestigationId = getRunningInvestigationId(session.investigation);
  useEffect(() => {
    if (!sessions || !runningInvestigationId) {
      return;
    }
    const timer = setInterval(() => void sessions.refreshInvestigation(id), INVESTIGATION_POLL_MS);
    return () => clearInterval(timer);
  }, [sessions, id, runningInvestigationId]);

  const { compareWithPreviousPeriod, breakdownVariable } = options;
  const question: InsightAskQuestion = {
    question: options.question ?? '',
    sourcePanelKeys: options.sourcePanelKeys ?? [],
    compareWithPreviousPeriod,
    breakdownVariable,
  };
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

  const { result } = session;
  const staleReasons = useMemo(() => {
    if (!result || !capture) {
      return [];
    }
    // An off-screen source has not changed just because it has not loaded; asking loads it.
    const current = capture.snapshot ?? (capture.unloaded ? result.snapshot : undefined);
    return getInsightStaleReasons(result.snapshot, capture.context, capture.keys, current, {
      settings: { compareWithPreviousPeriod, breakdownVariable },
      framesOmitted: result.framesOmitted,
    });
  }, [result, capture, compareWithPreviousPeriod, breakdownVariable]);

  const followUps = useMemo(
    () =>
      (options.followUps ?? [])
        .map((followUp) => followUp.trim())
        .filter(Boolean)
        .map((followUp) => session.followUps[followUp] ?? { question: followUp, running: false }),
    [options.followUps, session.followUps]
  );

  return {
    result,
    running: session.running,
    loadingSources: session.loadingSources,
    error: session.error,
    staleReasons,
    unavailable: capture?.unloaded ? undefined : capture?.unavailable,
    sources,
    followUps,
    sharing: Boolean(session.sharing),
    shareError: session.shareError,
    canShare: Boolean(dashboard && canShareInsightAnswers(dashboard)),
    investigation: session.investigation,
    investigationsUnavailable,
    ask: () => void sessions?.ask(id, question),
    askFollowUp: (followUp) => void sessions?.askFollowUp(id, followUp),
    share: () => void sessions?.share(id),
    investigate: () => void sessions?.investigate(id),
  };
}
