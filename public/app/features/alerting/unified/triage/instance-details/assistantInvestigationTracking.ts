import { reportInteraction } from '@grafana/runtime';

import type { StartInvestigationViewModel } from './startInvestigationViewModel';

/** Visible (non-hidden) UI statuses for the instance-drawer investigation control. */
export type AssistantInvestigationUiStatus = Exclude<StartInvestigationViewModel['status'], 'hidden'>;

type StartFromStatus = Extract<AssistantInvestigationUiStatus, 'idle' | 'startError' | 'reportFailed'>;
type OpenReportFromStatus = Extract<AssistantInvestigationUiStatus, 'completed' | 'reportFailed'>;
type WatchLiveFromStatus = Extract<AssistantInvestigationUiStatus, 'running' | 'pollError'>;
type RetryFromStatus = Extract<AssistantInvestigationUiStatus, 'lookupError' | 'pollError'>;

/** Fired once when the drawer investigation control becomes available (flags + plugin). */
export function trackAssistantInvestigationImpression() {
  reportInteraction('grafana_alerting_assistant_investigation_impression');
}

export function trackAssistantInvestigationStartClicked(payload: { from_status: StartFromStatus }) {
  reportInteraction('grafana_alerting_assistant_investigation_start_clicked', payload);
}

export function trackAssistantInvestigationStartSucceeded(payload: {
  from_status: StartFromStatus;
  investigation_id: string;
}) {
  reportInteraction('grafana_alerting_assistant_investigation_start_succeeded', payload);
}

export function trackAssistantInvestigationStartFailed(payload: { from_status: StartFromStatus }) {
  reportInteraction('grafana_alerting_assistant_investigation_start_failed', payload);
}

export function trackAssistantInvestigationOpenReport(payload: {
  from_status: OpenReportFromStatus;
  investigation_id: string;
}) {
  reportInteraction('grafana_alerting_assistant_investigation_open_report', payload);
}

export function trackAssistantInvestigationWatchLive(payload: {
  from_status: WatchLiveFromStatus;
  investigation_id: string;
}) {
  reportInteraction('grafana_alerting_assistant_investigation_watch_live', payload);
}

/** Recovery actions that are not a fresh start (lookup / poll only). */
export function trackAssistantInvestigationRetry(payload: {
  retry_type: 'lookup' | 'poll';
  from_status: RetryFromStatus;
}) {
  reportInteraction('grafana_alerting_assistant_investigation_retry', payload);
}
