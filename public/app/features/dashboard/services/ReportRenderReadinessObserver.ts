import { performanceUtils } from '@grafana/scenes';

import { registerPerformanceObserver } from './performanceUtils';

interface MessageEventPayloadMap {
  REPORT_RENDER_COMPLETE: { success: boolean };
}

type MessageEventType = keyof MessageEventPayloadMap;

interface MessageEvent<T extends MessageEventType> {
  type: T;
  data: MessageEventPayloadMap[T];
}

/**
 * Performance observer that signals to the grafana-image-renderer when a dashboard
 * has finished rendering all panels for report capture.
 *
 * Sets `window.__grafana_report_render_complete` to `true` when a `dashboard_view`
 * interaction completes, meaning all panels have gone through the full lifecycle
 * (queries, transforms, field config, rendering).
 *
 * This observer is only registered for report routes to avoid any overhead on
 * normal dashboard usage.
 */
export class ReportRenderReadinessObserver implements performanceUtils.ScenePerformanceObserver {
  onDashboardInteractionComplete = (data: performanceUtils.DashboardInteractionCompleteData): void => {
    if (data.interactionType === 'dashboard_view') {
      sendMessageEvent('REPORT_RENDER_COMPLETE', { success: true });
    }
  };
}

let instance: ReportRenderReadinessObserver | null = null;

export function initializeReportRenderReadinessObserver(): void {
  if (!instance) {
    instance = new ReportRenderReadinessObserver();
    registerPerformanceObserver(instance, 'RRO');
  }
}

const createMessageEvent = <T extends MessageEventType>(
  eventType: T,
  data: MessageEventPayloadMap[T]
): MessageEvent<T> => {
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
