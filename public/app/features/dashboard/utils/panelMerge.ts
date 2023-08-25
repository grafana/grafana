import { isEqualWith } from 'lodash';

import { PanelModel as IPanelModel } from '@grafana/data';

import { PanelModel } from '../state';

export interface PanelMergeInfo {
  changed: boolean;
  panels: PanelModel[];
  actions: Record<string, number[]>;
}

// Values that are safe to change without a full panel unmount/remount
// TODO: options and fieldConfig should also be supported
const mutableKeys = new Set<keyof PanelModel>(['gridPos', 'title', 'description', 'transparent']);

export function mergePanels(current: PanelModel[], data: IPanelModel[]): PanelMergeInfo {
  const panels: PanelModel[] = [];
  const info: PanelMergeInfo = {
    changed: false,
    actions: {
      add: [],
      remove: [],
      replace: [],
      update: [],
      noop: [],
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
      p = { ...p, id }; // clone with new ID
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
      let isNoop = true;
      let doUpdate = false;
      for (const [key, value] of Object.entries(target)) {
        if (!isEqualWith(value, save[key], infinityEqualsNull)) {
          info.changed = true;
          isNoop = false;
          if (mutableKeys.has(key as any)) {
            (panel as any)[key] = value;
            doUpdate = true;
          } else {
            doUpdate = false;
            break; // needs full replace
          }
        }
      }

      if (isNoop) {
        panels.push(panel);
        info.actions.noop.push(panel.id);
        continue;
      }

      if (doUpdate) {
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

// Since +- Infinity are saved as null in JSON, we need to make them equal here also
function infinityEqualsNull(a: unknown, b: unknown) {
  if (a == null && (b === Infinity || b === -Infinity || b == null)) {
    return true;
  }
  if (b == null && (a === Infinity || a === -Infinity || a == null)) {
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
