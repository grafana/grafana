import { SceneObjectBase, SceneObjectStateChangedEvent, type SceneObjectState } from '@grafana/scenes';

import { getDashboardSceneLike } from '../../scene/types/dashboard';

import { DashboardInsightsPaneRenderer } from './DashboardInsightsPaneRenderer';

/**
 * The layout, titles, and options that decide which Insight panels are listed and which panels the sources
 * editor offers. Each insight observes its own data, time range, and variables.
 */
const RERENDER_KEYS = ['options', 'pluginId', 'title', 'hideHeader', 'children', 'tabs', 'rows'];

export class DashboardInsightsPane extends SceneObjectBase<SceneObjectState> {
  public static Component = DashboardInsightsPaneRenderer;

  public minWidth = 380;

  public constructor(state?: Partial<SceneObjectState>) {
    super({ ...state });
    this.addActivationHandler(() => this.onActivate());
  }

  private onActivate() {
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
}
