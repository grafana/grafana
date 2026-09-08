import { type Unsubscribable } from 'rxjs';

import { config } from '@grafana/runtime';
import { type SceneQueryControllerLike, type performanceUtils } from '@grafana/scenes';

import { registerPerformanceObserver } from './performanceUtils';

interface MessageEventPayloadMap {
  REPORT_RENDER_COMPLETE: { success: boolean };
}

type MessageEventType = keyof MessageEventPayloadMap;

interface RenderBindingMessage<T extends MessageEventType> {
  type: T;
  data: MessageEventPayloadMap[T];
}

/**
 * Performance observer that signals to the grafana-image-renderer when a dashboard
 * has finished rendering all panels for report capture.
 *
 * Sends a `REPORT_RENDER_COMPLETE` message via the `window.__grafanaImageRendererMessageChannel`
 * chromedp binding once a `dashboard_view` interaction completes. Behind the `reportRenderQueryDebounce`
 * feature toggle, it instead waits until the query controller has then stayed idle for
 * `config.reportRenderQueryGracePeriodMs` (see the `report_render_query_grace_period` setting) before
 * sending — the scenes profiler's own completion signal fires as soon as queries momentarily hit
 * zero, which races with repeat panels that register their queries late (e.g. after a repeat
 * variable's own query resolves). The grace window pauses while any query is running, however long
 * it takes, and only counts down once the controller is genuinely idle. This has no ceiling today: a
 * report-rendered dashboard whose queries never fully settle (e.g. a fast auto-refresh or "Live now")
 * will wait indefinitely for this signal rather than completing early, bounded only by the backend's
 * own render request timeout — this is why the behavior is opt-in rather than the default.
 *
 * This observer is only registered for report routes to avoid any overhead on
 * normal dashboard usage.
 */
export class ReportRenderReadinessObserver implements performanceUtils.ScenePerformanceObserver {
  private graceTimer: ReturnType<typeof setTimeout> | null = null;
  private stateSubscription: Unsubscribable | null = null;
  // True from the first dashboard_view completion until we actually send the message — guards the
  // subscription below so it only acts once we've entered the settle-and-verify phase.
  private settling = false;

  constructor(private queryController?: SceneQueryControllerLike) {}

  onDashboardInteractionComplete = (data: performanceUtils.DashboardInteractionCompleteData): void => {
    if (data.interactionType !== 'dashboard_view') {
      return;
    }

    // Behind an experimental, default-off toggle: this changes *when* the render-complete signal
    // fires for every report/embed capture, so it can be enabled selectively (e.g. for a customer
    // hitting the repeat-panel race) without changing behavior for everyone else.
    if (!config.featureToggles.reportRenderQueryDebounce || !this.queryController) {
      sendMessageEvent('REPORT_RENDER_COMPLETE', { success: true });
      return;
    }

    this.settling = true;

    if (!this.stateSubscription) {
      // Pause the grace timer for as long as any query is running, and only start it once the
      // controller goes idle — a fixed delay from the *start* of a late query would fire while
      // that query is still in flight if it takes longer than the grace window to complete.
      this.stateSubscription = this.queryController.subscribeToState((newState) => {
        if (!this.settling) {
          return;
        }
        if (newState.isRunning) {
          this.clearGraceTimer();
        } else {
          this.armGraceTimer();
        }
      });
    }

    if (!this.queryController.state.isRunning) {
      this.armGraceTimer();
    }
  };

  private armGraceTimer(): void {
    this.clearGraceTimer();
    this.graceTimer = setTimeout(() => {
      this.graceTimer = null;
      this.settling = false;
      sendMessageEvent('REPORT_RENDER_COMPLETE', { success: true });
    }, config.reportRenderQueryGracePeriodMs);
  }

  private clearGraceTimer(): void {
    if (this.graceTimer) {
      clearTimeout(this.graceTimer);
      this.graceTimer = null;
    }
  }
}

let instance: ReportRenderReadinessObserver | null = null;

// Keeps the first instance and ignores later queryController args — fine only because a renderer tab
// never runs a second loadDashboard() today. If that changes, this must rebind to the new controller.
export function initializeReportRenderReadinessObserver(queryController?: SceneQueryControllerLike): void {
  if (!instance) {
    instance = new ReportRenderReadinessObserver(queryController);
    registerPerformanceObserver(instance, 'RRO');
  }
}

const createMessageEvent = <T extends MessageEventType>(
  eventType: T,
  data: MessageEventPayloadMap[T]
): RenderBindingMessage<T> => {
  return {
    type: eventType,
    data,
  };
};

const sendMessageEvent = <T extends MessageEventType>(eventType: T, data: MessageEventPayloadMap[T]) => {
  // check if chromedp binding exists. It only takes a string argument.
  if (window.__grafanaImageRendererMessageChannel) {
    window.__grafanaImageRendererMessageChannel(JSON.stringify(createMessageEvent(eventType, data)));
  }
};
