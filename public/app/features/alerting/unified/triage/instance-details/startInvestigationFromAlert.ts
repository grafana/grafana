import { type Labels } from '@grafana/data';
import { config } from '@grafana/runtime';
import { type GrafanaRuleDefinition } from 'app/types/unified-alerting-dto';

import { type StartInvestigationFromAlertRequest } from '../../api/assistantApi';
import { createBridgeURL } from '../../components/PluginBridge';
import { type LogRecord } from '../../components/rules/state-history/common';
import { SupportedPlugin } from '../../types/pluginBridges';

/** How often to refresh investigation state while a report is still generating. */
export const ASSISTANT_INVESTIGATION_POLL_INTERVAL_MS = 3000;

/** True when both product toggles for the manual investigation entry point are on. */
export function isManualAssistantInvestigationEnabled(): boolean {
  return Boolean(
    config.featureToggles.alertingEnrichmentAssistantInvestigations &&
      config.featureToggles.alertingManualAssistantInvestigation
  );
}

// Includes paused — loops can pause mid-run and should keep the "in progress" UI.
const ACTIVE_INVESTIGATION_STATES = new Set(['pending', 'running', 'in_progress', 'in-progress', 'paused']);

const TERMINAL_INVESTIGATION_STATES = new Set(['completed', 'failed', 'cancelled', 'canceled']);

/** True while the Assistant is still producing the report (or paused mid-run). */
export function isAssistantInvestigationActive(state: string | undefined): boolean {
  return !!state && ACTIVE_INVESTIGATION_STATES.has(state);
}

/** True when the investigation finished successfully. */
export function isAssistantInvestigationCompleted(state: string | undefined): boolean {
  return state === 'completed';
}

/** True when the investigation failed or was cancelled. */
export function isAssistantInvestigationFailed(state: string | undefined): boolean {
  return state === 'failed' || state === 'cancelled' || state === 'canceled';
}

/** True when polling can stop — completed, failed, or cancelled. */
export function isAssistantInvestigationTerminal(state: string | undefined): boolean {
  return !!state && TERMINAL_INVESTIGATION_STATES.has(state);
}

/** Builds a link to the investigation's report in the Assistant app. */
export function getAssistantInvestigationUrl(investigationId: string): string {
  return createBridgeURL(SupportedPlugin.Assistant, `/investigations/${encodeURIComponent(investigationId)}`);
}

function isAlertingState(state: string | undefined): boolean {
  return String(state ?? '')
    .toLowerCase()
    .includes('alerting');
}

/**
 * ISO start time for the current firing episode from state history.
 * Only returns a start when history shows an enter-Alerting transition that
 * has not yet been closed by a later leave-Alerting event in the same window.
 * Truncated or ambiguous history returns undefined so startsAt is omitted.
 */
export function getAlertInstanceStartsAtIso(historyRecords: LogRecord[] | undefined): string | undefined {
  if (!historyRecords?.length) {
    return undefined;
  }

  const ordered = [...historyRecords].sort((a, b) => a.timestamp - b.timestamp);
  let openEpisodeStart: number | undefined;

  for (const record of ordered) {
    const wasAlerting = isAlertingState(record.line.previous);
    const isAlerting = isAlertingState(record.line.current);
    if (!wasAlerting && isAlerting) {
      openEpisodeStart = record.timestamp;
    } else if (wasAlerting && !isAlerting) {
      openEpisodeStart = undefined;
    }
  }

  return openEpisodeStart !== undefined ? new Date(openEpisodeStart).toISOString() : undefined;
}

export interface BuildFromAlertRequestArgs {
  instanceLabels: Labels;
  commonLabels?: Labels;
  rule?: GrafanaRuleDefinition;
}

/** Builds the stable from-alert payload (no startsAt/status/name/generatorURL). */
export function buildFromAlertRequest({
  instanceLabels,
  commonLabels,
  rule,
}: BuildFromAlertRequestArgs): StartInvestigationFromAlertRequest {
  const externalURL = config.appUrl.replace(/\/$/, '');

  // Stable alert-group identity for Assistant dedup/lookup. Prefer instance labels;
  // when an instance has none, fall back to rule identity so reopen still finds the link.
  const groupLabels: Record<string, string> =
    Object.keys(instanceLabels).length > 0
      ? { ...instanceLabels }
      : {
          ...(rule?.title ? { alertname: rule.title } : {}),
          ...(rule?.uid ? { rule_uid: rule.uid } : {}),
        };

  return {
    alerts: [
      {
        labels: instanceLabels,
      },
    ],
    commonLabels,
    groupLabels,
    externalURL,
  };
}
