import { getInvestigation, InvestigationRequestError, startInvestigation } from '@grafana/assistant';
import { t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { type DashboardSceneLike } from 'app/features/dashboard-scene/scene/types/dashboard';
import { CancelInsightRequestsEvent } from 'app/features/dashboard-scene/sidebar/events';
import { parseInsightAnswer } from 'app/features/dashboard-scene/sidebar/insights/answer';
import { askInsightAssistant, INSIGHTS_ORIGIN } from 'app/features/dashboard-scene/sidebar/insights/askAssistant';
import {
  buildInsightInvestigation,
  canStartInvestigation,
  getRunningInvestigationId,
} from 'app/features/dashboard-scene/sidebar/insights/investigation';
import {
  loadSharedInsightAnswers,
  shareInsightAnswer,
} from 'app/features/dashboard-scene/sidebar/insights/sharedAnswers';
import { captureInsightSnapshot } from 'app/features/dashboard-scene/sidebar/insights/snapshot';
import { getInsightSourcePanels, loadInsightSources } from 'app/features/dashboard-scene/sidebar/insights/sources';
import {
  type InsightInvestigation,
  type InsightQuestion,
  type InsightResult,
} from 'app/features/dashboard-scene/sidebar/insights/types';
import { loadInsightVariants } from 'app/features/dashboard-scene/sidebar/insights/variants';

import { buildFollowUpSystemPrompt } from './followUpPrompt';

/** Each ask may load source panels and run a model request, so Ask all keeps only a few in flight. */
const ASK_ALL_CONCURRENCY = 2;

export type InsightAskQuestion = Pick<
  InsightQuestion,
  'question' | 'sourcePanelKeys' | 'compareWithPreviousPeriod' | 'breakdownVariable'
>;

/** One author-defined follow-up and its own answer, threaded under the main answer. */
export interface InsightFollowUpThread {
  question: string;
  running: boolean;
  result?: InsightResult;
  error?: string;
}

export interface InsightSession {
  /** The main question's answer, if it has been asked. */
  result?: InsightResult;
  running: boolean;
  /** Off-screen sources, the previous period, or breakdown values are loading before the question is sent. */
  loadingSources: boolean;
  error?: string;
  /** Keyed by follow-up question. A new main answer clears them, since they answered the previous one. */
  followUps: Record<string, InsightFollowUpThread>;
  sharing?: boolean;
  shareError?: string;
  /** Kept across new answers: it explains the question, and the Assistant keeps working on it. */
  investigation?: InsightInvestigation;
}

export const EMPTY_INSIGHT_SESSION: InsightSession = { running: false, loadingSources: false, followUps: {} };

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Every insight's session on one dashboard, keyed by panel key for Insight panels and by question id for the
 * sidebar's saved questions. An Insight panel and its sidebar entry share one session, and a session survives
 * the panel remounting, for example when switching tabs. Answers are only kept when an editor shares one, and
 * nothing here runs a query or a model request on its own — the viewer asks.
 */
export class InsightSessions {
  private sessions = new Map<string, InsightSession>();
  private requests = new Map<string, AbortController>();
  private followUpRequests = new Map<string, Map<string, AbortController>>();
  private investigationReads = new Set<string>();
  private listeners = new Set<() => void>();
  private sharedLoad?: Promise<void>;
  private askAllRun = 0;
  private askingAll = false;
  private investigationsUnavailable = false;

  public constructor(private dashboard: DashboardSceneLike) {
    dashboard.subscribeToEvent(CancelInsightRequestsEvent, () => this.cancelAll());
  }

  public get(id: string): InsightSession {
    return this.sessions.get(id) ?? EMPTY_INSIGHT_SESSION;
  }

  public isAskingAll = () => this.askingAll;

  /** The Assistant said it cannot start investigations here, for example in OSS mode, so retrying would fail too. */
  public areInvestigationsUnavailable = () => this.investigationsUnavailable;

  public subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  public async ask(id: string, question: InsightAskQuestion): Promise<void> {
    if (this.requests.has(id)) {
      return;
    }

    const initial = captureInsightSnapshot(this.dashboard, question);
    // An unloaded source is not a refusal: asking loads it first.
    if (!initial.snapshot && !initial.unloaded) {
      this.patch(id, { error: initial.unavailable });
      return;
    }

    const controller = new AbortController();
    this.requests.set(id, controller);
    this.patch(id, { running: true, error: undefined, shareError: undefined });

    try {
      const selected = getInsightSourcePanels(this.dashboard).filter((source) => initial.keys.includes(source.key));
      const loading = loadInsightSources(selected, controller.signal);
      const extended = Boolean(question.compareWithPreviousPeriod || question.breakdownVariable?.trim());
      if (loading || extended) {
        this.patch(id, { loadingSources: true });
      }
      await loading;
      if (controller.signal.aborted) {
        return;
      }
      const variants = await loadInsightVariants(
        this.dashboard,
        selected,
        initial.context,
        question,
        controller.signal
      );
      if (controller.signal.aborted) {
        return;
      }
      this.patch(id, { loadingSources: false });

      const { snapshot, unavailable } =
        loading || extended ? captureInsightSnapshot(this.dashboard, question, variants) : initial;
      if (!snapshot) {
        throw new Error(unavailable);
      }
      if (snapshot.previousPeriod && snapshot.previousPeriod.to !== snapshot.from) {
        throw new Error(
          t('textng.insight.time-range-moved', 'The time range changed while loading the previous period. Ask again.')
        );
      }

      const content = parseInsightAnswer(await askInsightAssistant(snapshot, controller.signal), snapshot);
      this.cancelFollowUps(id);
      this.patch(id, {
        result: { content, snapshot, completedAt: new Date().toISOString(), sourceLocation: window.location.href },
        error: undefined,
        followUps: {},
      });
    } catch (error) {
      if (!controller.signal.aborted) {
        this.patch(id, { error: errorMessage(error) });
      }
    } finally {
      if (this.requests.get(id) === controller) {
        this.requests.delete(id);
      }
      // After a cancel, a newer ask for the same insight may already own the running state.
      if (!this.requests.has(id)) {
        this.patch(id, { running: false, loadingSources: false });
      }
    }
  }

  /** Asks each insight in turn, a few at a time. Cancelling stops the queue as well as the requests in flight. */
  public async askAll(items: Array<{ id: string; question: InsightAskQuestion }>): Promise<void> {
    if (this.askingAll) {
      return;
    }
    const run = ++this.askAllRun;
    const queue = items.filter(({ id }) => !this.requests.has(id));
    this.setAskingAll(true);
    const worker = async () => {
      for (let item = queue.shift(); item && run === this.askAllRun; item = queue.shift()) {
        await this.ask(item.id, item.question);
      }
    };
    try {
      await Promise.all(Array.from({ length: ASK_ALL_CONCURRENCY }, worker));
    } finally {
      if (run === this.askAllRun) {
        this.setAskingAll(false);
      }
    }
  }

  public async askFollowUp(id: string, followUp: string): Promise<void> {
    // A follow-up answers against the snapshot the main answer used, so the thread stays consistent:
    // no re-capture, no source loading, and no new data mid-conversation.
    const { result } = this.get(id);
    const pending = this.followUpRequests.get(id) ?? new Map<string, AbortController>();
    if (!result || result.framesOmitted || pending.has(followUp)) {
      return;
    }

    const controller = new AbortController();
    pending.set(followUp, controller);
    this.followUpRequests.set(id, pending);
    // A reply to an answer that has since been replaced must not land in the new answer's threads.
    const isCurrent = () => this.get(id).result === result;
    this.patchFollowUp(id, followUp, { running: true, error: undefined });

    try {
      const snapshot = { ...result.snapshot, question: followUp };
      const text = await askInsightAssistant(
        snapshot,
        controller.signal,
        buildFollowUpSystemPrompt(result.snapshot.question, result.content)
      );
      const content = parseInsightAnswer(text, snapshot);
      if (isCurrent()) {
        this.patchFollowUp(id, followUp, {
          result: { content, snapshot, completedAt: new Date().toISOString(), sourceLocation: window.location.href },
          error: undefined,
        });
      }
    } catch (error) {
      if (!controller.signal.aborted && isCurrent()) {
        this.patchFollowUp(id, followUp, { error: errorMessage(error) });
      }
    } finally {
      if (pending.get(followUp) === controller) {
        pending.delete(followUp);
      }
      if (isCurrent() && !this.followUpRequests.get(id)?.has(followUp)) {
        this.patchFollowUp(id, followUp, { running: false });
      }
    }
  }

  /** Makes the current answer the one everyone who opens the dashboard sees until someone shares a newer one. */
  public async share(id: string): Promise<void> {
    const { result, sharing } = this.get(id);
    const uid = this.dashboard.state.uid;
    if (!result || result.share || sharing || !uid) {
      return;
    }
    this.patch(id, { sharing: true, shareError: undefined });
    try {
      const share = await shareInsightAnswer(uid, id, result);
      if (this.get(id).result === result) {
        this.patch(id, { result: { ...result, share } });
      }
    } catch (error) {
      this.patch(id, {
        shareError: t('textng.insight.share-error', 'Could not share this answer: {{error}}', {
          error: errorMessage(error),
        }),
      });
    } finally {
      this.patch(id, { sharing: false });
    }
  }

  /** Starts an Assistant investigation from the current answer, unless one is already running for this insight. */
  public async investigate(id: string): Promise<void> {
    const { result, investigation } = this.get(id);
    if (!result || !canStartInvestigation(investigation)) {
      return;
    }
    this.patch(id, { investigation: { phase: 'starting' } });
    try {
      const { title, instruction } = buildInsightInvestigation(this.dashboard.state.title, result);
      const status = await startInvestigation({ origin: INSIGHTS_ORIGIN, title, instruction });
      this.patch(id, { investigation: { phase: 'started', ...status } });
      reportInteraction('dashboards_insights_investigation_started', {
        sourcePanels: result.snapshot.panels.length,
        shared: Boolean(result.share),
      });
    } catch (error) {
      if (error instanceof InvestigationRequestError && error.code === 'unavailable') {
        this.investigationsUnavailable = true;
      }
      this.patch(id, { investigation: { phase: 'failed', error: errorMessage(error) } });
    }
  }

  /** Re-reads a running investigation's state. Every view of the insight polls, so only one read runs at a time. */
  public async refreshInvestigation(id: string): Promise<void> {
    const investigationId = getRunningInvestigationId(this.get(id).investigation);
    if (!investigationId || this.investigationReads.has(id)) {
      return;
    }
    this.investigationReads.add(id);
    try {
      const status = await getInvestigation(investigationId);
      const current = this.get(id).investigation;
      if (current?.phase === 'started' && current.investigationId === investigationId) {
        this.patch(id, { investigation: { phase: 'started', ...status } });
      }
    } catch {
      // A failed read is retried on the next poll; the investigation itself is unaffected.
    } finally {
      this.investigationReads.delete(id);
    }
  }

  /**
   * Loads the dashboard's shared answers once. An insight the viewer has already asked keeps its own answer.
   * Failing to load is not an error: the viewer can still ask.
   */
  public loadShared(): void {
    const uid = this.dashboard.state.uid;
    if (this.sharedLoad || !uid) {
      return;
    }
    this.sharedLoad = loadSharedInsightAnswers(uid)
      .then((answers) => {
        for (const [id, result] of answers) {
          const session = this.get(id);
          if (!session.result && !session.running) {
            this.patch(id, { result });
          }
        }
      })
      .catch(() => undefined);
  }

  /** Carries an answer over when a question moves between the sidebar and an Insight panel. */
  public copy(from: string, to: string): void {
    const { result, followUps, investigation } = this.get(from);
    if (!result) {
      return;
    }
    const answered = Object.fromEntries(
      Object.entries(followUps)
        .filter(([, thread]) => thread.result)
        .map(([question, thread]) => [question, { ...thread, running: false, error: undefined }])
    );
    this.patch(to, {
      result,
      followUps: answered,
      investigation: investigation?.phase === 'started' ? investigation : undefined,
    });
  }

  public cancelAll() {
    this.askAllRun++;
    this.setAskingAll(false);
    for (const controller of this.requests.values()) {
      controller.abort();
    }
    this.requests.clear();
    for (const id of [...this.followUpRequests.keys()]) {
      this.cancelFollowUps(id);
    }
  }

  private setAskingAll(value: boolean) {
    if (this.askingAll !== value) {
      this.askingAll = value;
      this.notify();
    }
  }

  private cancelFollowUps(id: string) {
    for (const controller of this.followUpRequests.get(id)?.values() ?? []) {
      controller.abort();
    }
    this.followUpRequests.delete(id);
  }

  private notify() {
    for (const listener of this.listeners) {
      listener();
    }
  }

  private patch(id: string, patch: Partial<InsightSession>) {
    this.sessions.set(id, { ...this.get(id), ...patch });
    this.notify();
  }

  private patchFollowUp(id: string, followUp: string, patch: Partial<InsightFollowUpThread>) {
    const { followUps } = this.get(id);
    const previous = followUps[followUp] ?? { question: followUp, running: false };
    this.patch(id, { followUps: { ...followUps, [followUp]: { ...previous, ...patch } } });
  }
}

// Keyed by the scene so sessions last as long as the dashboard and leaving it drops them.
const sessionsByDashboard = new WeakMap<DashboardSceneLike, InsightSessions>();

export function getInsightSessions(dashboard: DashboardSceneLike): InsightSessions {
  let sessions = sessionsByDashboard.get(dashboard);
  if (!sessions) {
    sessions = new InsightSessions(dashboard);
    sessionsByDashboard.set(dashboard, sessions);
  }
  return sessions;
}
