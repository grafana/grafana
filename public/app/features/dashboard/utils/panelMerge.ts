import { PanelModel as IPanelModel } from '@grafana/data';
import { isEqualWith } from 'lodash';
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
      update: [] as number[],
      noop: [] as number[],
    },
    panels,
  };

  let nextId = 0;
  const inputPanels = new Map<number, IPanelModel>();
  for (let p of data) {
    let { id } = p;
    if (!id) {
      if (!nextId) {
        nextId = findNextPanelID([current, data]);
      }
      id = nextId++;
      p = { ...p, id };
    }
    inputPanels.set(id, p);
  }

  for (const panel of current) {
    const target = inputPanels.get(panel.id) as PanelModel;
    if (!target) {
      info.changed = true;
      info.actions.remove.push(panel.id);
      panel.destroy();
      continue;
    }
    inputPanels.delete(panel.id);

    // Fast comparison when working with the same panel objects
    if (target === panel) {
      panels.push(panel);
      info.actions.noop.push(panel.id);
      continue;
    }

    // Check if it is the same type
    if (panel.type === target.type) {
      const save = panel.getSaveModel();
      const changed: string[] = [];
      let hasChanges = false;
      for (const [key, value] of Object.entries(target)) {
        if (!isEqualWith(value, save[key], infinityAsNull)) {
          info.changed = true;
          hasChanges = true;
          switch (key) {
            case 'gridPos':
              panel.gridPos = value;
              break;
            case 'title':
              panel.title = value;
              break;
            default:
              changed.push(key);
          }
        }
      }

      if (!hasChanges) {
        panels.push(panel);
        info.actions.noop.push(panel.id);
        continue;
      }

      if (!changed.length) {
        panels.push(panel);
        info.actions.update.push(panel.id);
        continue;
      }
    }
    panel.destroy();

    const next = new PanelModel(target);
    next.key = `${next.id}-update-${Date.now()}`; // force react invalidate
    panels.push(next);
    info.changed = true;
    info.actions.replace.push(panel.id);
  }

  // Add the new panels
  for (const t of inputPanels.values()) {
    panels.push(new PanelModel(t));
    info.changed = true;
    info.actions.add.push(t.id);
  }

  return info;
}

function infinityAsNull(a: any, b: any) {
  if (a == null && (b === Infinity || b === -Infinity)) {
    return true;
  }
  return undefined; // use default comparison
}

function findNextPanelID(args: IPanelModel[][]): number {
  let max = 0;
  for (const panels of args) {
    for (const panel of panels) {
      if (panel.id > max) {
        max = panel.id;
      }
    }
  }
  return max + 1;
}
