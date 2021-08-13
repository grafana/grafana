import { PanelModel as IPanelModel } from '@grafana/data';
import { isEqual } from 'lodash';
import { PanelModel } from '../state';

export interface PanelMergeInfo {
  changed: boolean;
  panels: PanelModel[];
  actions: Record<string, number[]>;
}

export function mergePanels(current: PanelModel[], data: IPanelModel[]): PanelMergeInfo {
  const panels: PanelModel[] = [];
  const info = {
    changed: false,
    actions: {
      add: [] as number[],
      remove: [] as number[],
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
      info.actions.remove.push(panel.id);
      continue;
    }
    inputPanels.delete(panel.id);
    const save = panel.getSaveModel();
    if (isEqual(save, target)) {
      panels.push(panel);
      info.actions.noop.push(panel.id);
      continue;
    }

    // Full replace for now
    // TODO: try to just update the models
    panels.push(new PanelModel(target));
    info.changed = true;
    info.actions.replace.push(panel.id);
    console.log('REPLACE', save, 'with', target);
  }

  // Add the new panels
  for (const t of inputPanels.values()) {
    panels.push(new PanelModel(t));
    info.changed = true;
    info.actions.add.push(t.id);
  }

  return info;
}
