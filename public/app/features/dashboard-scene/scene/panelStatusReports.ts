import { isEqual } from 'lodash';

import { type SceneObject, type VizPanel } from '@grafana/scenes';
import { type PanelStatusReport } from '@grafana/ui';

interface StoredPanelStatusReport {
  report: PanelStatusReport;
  // The configuration the panel rendered when it reported, to tell a current report from an outdated one.
  pluginId: string;
  options: VizPanel['state']['options'];
  fieldConfig: VizPanel['state']['fieldConfig'];
}

// Keyed by panel key rather than by VizPanel: applying a whole spec rebuilds every VizPanel under the
// same key, and a panel whose configuration did not change has no reason to report again.
// Scoped by scene root so a key on one dashboard never reads a report from another.
const reportsByRoot = new WeakMap<SceneObject, Map<string, StoredPanelStatusReport>>();

export function setPanelStatusReport(vizPanel: VizPanel, report: PanelStatusReport) {
  const { key, pluginId, options, fieldConfig } = vizPanel.state;
  if (!key) {
    return;
  }
  const root = vizPanel.getRoot();
  const reports = reportsByRoot.get(root) ?? new Map<string, StoredPanelStatusReport>();
  reportsByRoot.set(root, reports.set(key, { report, pluginId, options, fieldConfig }));
}

/** `outdated` means the panel reported before its current configuration and has not reported since. */
export function getPanelStatusReport(vizPanel: VizPanel): { report: PanelStatusReport } | 'outdated' | undefined {
  const { key, pluginId, options, fieldConfig } = vizPanel.state;
  const stored = key ? reportsByRoot.get(vizPanel.getRoot())?.get(key) : undefined;
  // A report from another plugin says nothing about this one, which may never report.
  if (!stored || stored.pluginId !== pluginId) {
    return undefined;
  }
  const sameConfig = isEqual(stored.options, options) && isEqual(stored.fieldConfig, fieldConfig);
  return sameConfig ? { report: stored.report } : 'outdated';
}
