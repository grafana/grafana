import { SceneObjectBase, SceneObjectStateChangedEvent, type SceneObjectState } from '@grafana/scenes';

import { getDashboardSceneLike } from '../../scene/types/dashboard';

import { DashboardInsightsPaneRenderer } from './DashboardInsightsPaneRenderer';
import { parseInsightAnswer } from './answer';
import { askInsightAssistant } from './askAssistant';
import { captureInsightSnapshot } from './snapshot';
import { type InsightQuestion, type InsightRun } from './types';

/** Panel data, time range, and variable value changes. */
const RERENDER_KEYS = ['data', 'value', 'text', 'filters'];

export interface DashboardInsightsPaneState extends SceneObjectState {
  /** Session-local answers keyed by question id; never persisted. */
  runs: Record<string, InsightRun>;
  expanded: string[];
}

export class DashboardInsightsPane extends SceneObjectBase<DashboardInsightsPaneState> {
  public static Component = DashboardInsightsPaneRenderer;

  public minWidth = 380;

  private _requests = new Map<string, AbortController>();

  public constructor(state?: Partial<DashboardInsightsPaneState>) {
    super({ runs: {}, expanded: [], ...state });
    this.addActivationHandler(() => this.onActivate());
  }

  private onActivate() {
    // Source availability and out-of-date reasons derive from live panel data, time range, and variables.
    let frame: number | undefined;
    this._subs.add(
      getDashboardSceneLike(this).subscribeToEvent(SceneObjectStateChangedEvent, ({ payload }) => {
        const update = payload.partialUpdate;
        if (frame !== undefined || !RERENDER_KEYS.some((key) => key in update)) {
          return;
        }
        frame = requestAnimationFrame(() => {
          frame = undefined;
          this.forceRender();
        });
      })
    );

    return () => {
      if (frame !== undefined) {
        cancelAnimationFrame(frame);
      }
    };
  }

  public getId() {
    return 'insights' as const;
  }

  public clone(withState?: Partial<DashboardInsightsPaneState>): this {
    // In-flight requests belong to the live pane; a copy must never look busy.
    const runs: Record<string, InsightRun> = {};
    for (const [id, run] of Object.entries(this.state.runs)) {
      runs[id] = { ...run, running: false };
    }
    return super.clone({ runs, ...withState });
  }

  public toggleExpanded(id: string) {
    const { expanded } = this.state;
    this.setState({ expanded: expanded.includes(id) ? expanded.filter((item) => item !== id) : [...expanded, id] });
  }

  public async ask(question: InsightQuestion): Promise<void> {
    if (this._requests.has(question.id)) {
      return;
    }

    const { snapshot, unavailable } = captureInsightSnapshot(getDashboardSceneLike(this), question);
    if (!snapshot) {
      this.updateRun(question.id, { error: unavailable });
      return;
    }

    const controller = new AbortController();
    this._requests.set(question.id, controller);
    this.updateRun(question.id, { running: true, error: undefined });

    try {
      const content = parseInsightAnswer(await askInsightAssistant(snapshot, controller.signal));
      this.updateRun(question.id, {
        result: { content, snapshot, completedAt: new Date().toISOString(), sourceLocation: window.location.href },
        error: undefined,
      });
    } catch (error) {
      if (!controller.signal.aborted) {
        this.updateRun(question.id, { error: error instanceof Error ? error.message : String(error) });
      }
    } finally {
      if (this._requests.get(question.id) === controller) {
        this._requests.delete(question.id);
      }
      this.updateRun(question.id, { running: false });
    }
  }

  public cancelPendingRequests() {
    for (const controller of this._requests.values()) {
      controller.abort();
    }
    this._requests.clear();
  }

  private updateRun(id: string, patch: Partial<InsightRun>) {
    const previous = this.state.runs[id] ?? { running: false };
    this.setState({ runs: { ...this.state.runs, [id]: { ...previous, ...patch } } });
  }
}
