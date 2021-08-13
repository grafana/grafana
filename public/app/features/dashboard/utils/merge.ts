import { PanelModel as IPanelModel } from '@grafana/data';
import { isEqual } from 'lodash';
import { PanelModel } from '../state';

export interface PanelMergeInfo {
  changed: boolean;
  panels: PanelModel[];
  changes: Record<string, number[]>;
}

export function mergePanels(current: PanelModel[], data: IPanelModel[]): PanelMergeInfo {
  const panels: PanelModel[] = [];
  const info = {
    changed: false,
    changes: {
      added: [] as number[],
      removed: [] as number[],
      replace: [] as number[],
      noop: [] as number[],
    },
    panels,
  };
  const inputPanels = new Map<number, IPanelModel>();
  for (const p of data) {
    inputPanels.set(p.id, p);
  }

  for (const panel of current) {
    const target = inputPanels.get(panel.id); // the same model
    if (!target) {
      info.changed = true;
      info.changes.removed.push(panel.id);
      continue;
    }
    inputPanels.delete(panel.id);
    const save = panel.getSaveModel();
    if (isEqual(save, target)) {
      panels.push(panel);
      info.changes.noop.push(panel.id);
      continue;
    }

    // Full replace for now
    // TODO: try to just update the models
    panels.push(new PanelModel(target));
    info.changed = true;
    info.changes.replace.push(panel.id);
  }

  // Add the new panels
  for (const t of inputPanels.values()) {
    panels.push(new PanelModel(t));
    info.changed = true;
    info.changes.added.push(t.id);
  }

  return info;
}
