import { PanelModel as IPanelModel, Threshold } from '@grafana/data';
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
    const target = inputPanels.get(panel.id) as PanelModel; // the same model
    if (!target) {
      info.changed = true;
      info.actions.remove.push(panel.id);
      panel.destroy();
      continue;
    }
    inputPanels.delete(panel.id);

    // Type changed trigger full refresh
    if (panel.type !== target.type) {
      panel.destroy();

      const next = new PanelModel(target);
      next.key = `${next.id}-update-${Date.now()}`; // force react replacement
      panels.push(next);
      info.changed = true;
      info.actions.replace.push(panel.id);
      continue;
    }

    // All new properties are the same
    const save = normalizeSaveModel(panel.getSaveModel());
    const changed: string[] = [];
    for (const [key, value] of Object.entries(target)) {
      if (!isEqual(value, save[key])) {
        changed.push(key);
      }
    }

    if (changed.length) {
      panel.destroy();
      console.log('CHANGED', panel.id, panel.title, changed);

      const next = new PanelModel(target);
      next.key = `${next.id}-update-${Date.now()}`; // force react replacement
      panels.push(next);
      info.changed = true;
      info.actions.replace.push(panel.id);
    } else {
      panels.push(panel);
      info.actions.noop.push(panel.id);
    }
  }

  // Add the new panels
  for (const t of inputPanels.values()) {
    panels.push(new PanelModel(t));
    info.changed = true;
    info.actions.add.push(t.id);
  }

  return info;
}

// Some values (like -Infinity) don't save the same in the panel
export function normalizeSaveModel(model: any): any {
  const t = model.fieldConfig?.defaults?.thresholds?.steps as Threshold[];
  if (t) {
    if (t[0].value === -Infinity) {
      t[0].value = null as any;
    }
  }
  return model;
}
