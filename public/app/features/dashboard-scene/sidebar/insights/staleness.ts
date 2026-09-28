import { t } from '@grafana/i18n';

import { type InsightContext, type InsightSnapshot, type InsightSnapshotPanel } from './types';

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function normalizeVariables(value: Record<string, string>): string {
  return JSON.stringify(Object.entries(value).sort(([a], [b]) => compareStrings(a, b)));
}

function normalizeKeys(value: string[]): string {
  return JSON.stringify([...new Set(value)].sort(compareStrings));
}

function normalizePanels(value: InsightSnapshotPanel[]): string {
  return JSON.stringify([...value].sort((a, b) => compareStrings(a.key, b.key)));
}

/**
 * Why a previous answer no longer matches the dashboard. `snapshot` is the current capture;
 * it is undefined when the selected sources cannot be captured right now.
 */
export function getInsightStaleReasons(
  previous: InsightSnapshot,
  current: InsightContext,
  selected: string[],
  snapshot?: InsightSnapshot
): string[] {
  const reasons: string[] = [];
  if (previous.question !== current.question.trim()) {
    reasons.push(t('dashboard.insights.stale.question', 'Question changed'));
  }
  if (previous.from !== current.from || previous.to !== current.to) {
    reasons.push(t('dashboard.insights.stale.time-range', 'Time range changed'));
  }
  if (normalizeVariables(previous.variables) !== normalizeVariables(current.variables)) {
    reasons.push(t('dashboard.insights.stale.filters', 'Filters changed'));
  }
  const sourcesChanged =
    previous.dashboardUid !== current.dashboardUid ||
    normalizeKeys(previous.panels.map((panel) => panel.key)) !== normalizeKeys(selected);
  if (sourcesChanged) {
    reasons.push(t('dashboard.insights.stale.sources', 'Source selection changed'));
  }
  if (snapshot && !sourcesChanged && normalizePanels(previous.panels) !== normalizePanels(snapshot.panels)) {
    reasons.push(t('dashboard.insights.stale.data', 'Source data changed'));
  }
  if (!snapshot && reasons.length === 0) {
    reasons.push(t('dashboard.insights.stale.unavailable', 'Source data unavailable'));
  }
  return reasons;
}
