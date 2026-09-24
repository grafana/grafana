import { type VizPanel } from '@grafana/scenes';
import { type InspectTab } from 'app/features/inspector/types';

type PanelInspectorOpener = (panel: VizPanel, tab: InspectTab) => void | Promise<void>;

let opener: PanelInspectorOpener | undefined;

// Low-level panel setup must not depend on the inspector implementation, even through a dynamic import.
export function setPanelInspectorOpener(fn: PanelInspectorOpener) {
  opener = fn;
}

export async function openPanelInspector(panel: VizPanel, tab: InspectTab) {
  await opener?.(panel, tab);
}
