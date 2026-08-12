import { type VizPanel } from '@grafana/scenes';
import { type InspectTab } from 'app/features/inspector/types';

type PanelInspectorOpener = (panel: VizPanel, tab: InspectTab) => void;

let opener: PanelInspectorOpener | undefined;

/**
 * Registers how a panel inspector is opened. This indirection exists so that low-level panel
 * setup (e.g. setDashboardPanelContext) can trigger the inspector without importing the heavy
 * PanelInspectDrawer, which would introduce a circular dependency.
 */
export function setPanelInspectorOpener(fn: PanelInspectorOpener) {
  opener = fn;
}

export function openPanelInspector(panel: VizPanel, tab: InspectTab) {
  opener?.(panel, tab);
}
