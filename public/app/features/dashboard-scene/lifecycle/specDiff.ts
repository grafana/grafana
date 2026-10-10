import { isEqual } from 'lodash';

import { isRecord } from 'app/core/utils/isRecord';

export type SpecChangeType = 'added' | 'edited' | 'removed';
export type SpecChangeTarget = 'panel' | 'variable' | 'layout' | 'settings';

export interface SpecChange {
  type: SpecChangeType;
  target: SpecChangeTarget;
  /** Panel or variable title, or the setting that changed. */
  name: string;
  /** Which parts of an edited panel changed, for example "queries, visualization". */
  parts?: string[];
  /** Scene key of the panel (panel-<id>), used to scroll to and highlight it. */
  panelKey?: string;
}

interface PanelInfo {
  id?: number;
  title: string;
  value: unknown;
  parts: Record<string, unknown>;
}

const SETTINGS_FIELDS = [
  'title',
  'description',
  'tags',
  'timeSettings',
  'time',
  'refresh',
  'links',
  'annotations',
  'cursorSync',
  'graphTooltip',
  'liveNow',
  'editable',
];

/**
 * Summarises the difference between two dashboard specs, v2 (elements + layout) or
 * classic (panels + templating), for the fork Compare view and change highlights.
 */
export function diffDashboardSpecs(base: unknown, next: unknown): SpecChange[] {
  const before = isRecord(base) ? base : {};
  const after = isRecord(next) ? next : {};
  const changes: SpecChange[] = [];

  const beforePanels = panelsOf(before);
  const afterPanels = panelsOf(after);
  for (const [key, panel] of afterPanels) {
    const old = beforePanels.get(key);
    if (!old) {
      changes.push({ type: 'added', target: 'panel', name: panel.title, panelKey: panelKeyOf(panel) });
    } else if (!isEqual(old.value, panel.value)) {
      const parts = Object.keys(panel.parts).filter((part) => !isEqual(old.parts[part], panel.parts[part]));
      changes.push({ type: 'edited', target: 'panel', name: panel.title, parts, panelKey: panelKeyOf(panel) });
    }
  }
  for (const [key, panel] of beforePanels) {
    if (!afterPanels.has(key)) {
      changes.push({ type: 'removed', target: 'panel', name: panel.title });
    }
  }

  const beforeVars = variablesOf(before);
  const afterVars = variablesOf(after);
  for (const [name, value] of afterVars) {
    if (!beforeVars.has(name)) {
      changes.push({ type: 'added', target: 'variable', name });
    } else if (!isEqual(beforeVars.get(name), value)) {
      changes.push({ type: 'edited', target: 'variable', name });
    }
  }
  for (const name of beforeVars.keys()) {
    if (!afterVars.has(name)) {
      changes.push({ type: 'removed', target: 'variable', name });
    }
  }

  if (!isEqual(layoutOf(before), layoutOf(after))) {
    changes.push({ type: 'edited', target: 'layout', name: 'layout' });
  }
  for (const field of SETTINGS_FIELDS) {
    if (!isEqual(before[field], after[field]) && (before[field] !== undefined || after[field] !== undefined)) {
      changes.push({ type: 'edited', target: 'settings', name: field });
    }
  }
  return changes;
}

/** Scene keys of the panels a set of changes adds or edits. */
export function changedPanelKeys(changes: SpecChange[]): Map<string, SpecChangeType> {
  const keys = new Map<string, SpecChangeType>();
  for (const change of changes) {
    if (change.target === 'panel' && change.panelKey && change.type !== 'removed') {
      keys.set(change.panelKey, change.type);
    }
  }
  return keys;
}

function panelKeyOf(panel: PanelInfo): string | undefined {
  return panel.id !== undefined ? `panel-${panel.id}` : undefined;
}

function panelsOf(spec: Record<string, unknown>): Map<string, PanelInfo> {
  const panels = new Map<string, PanelInfo>();
  if (isRecord(spec.elements)) {
    for (const [name, element] of Object.entries(spec.elements)) {
      if (!isRecord(element) || !isRecord(element.spec)) {
        continue;
      }
      const s = element.spec;
      panels.set(name, {
        id: typeof s.id === 'number' ? s.id : undefined,
        title: typeof s.title === 'string' && s.title ? s.title : name,
        value: element,
        parts: {
          title: s.title,
          description: s.description,
          queries: s.data,
          visualization: s.vizConfig,
          links: s.links,
          library: s.libraryPanel,
        },
      });
    }
    return panels;
  }
  const visit = (list: unknown) => {
    if (!Array.isArray(list)) {
      return;
    }
    for (const panel of list) {
      if (!isRecord(panel)) {
        continue;
      }
      if (panel.type === 'row') {
        visit(panel.panels);
        continue;
      }
      const id = typeof panel.id === 'number' ? panel.id : undefined;
      const { gridPos, ...rest } = panel;
      panels.set(id !== undefined ? String(id) : String(panels.size), {
        id,
        title: typeof panel.title === 'string' && panel.title ? panel.title : `Panel ${id ?? ''}`.trim(),
        value: rest,
        parts: {
          title: panel.title,
          description: panel.description,
          queries: panel.targets,
          visualization: [panel.type, panel.options, panel.fieldConfig],
          links: panel.links,
        },
      });
    }
  };
  visit(spec.panels);
  return panels;
}

function variablesOf(spec: Record<string, unknown>): Map<string, unknown> {
  const vars = new Map<string, unknown>();
  const list = Array.isArray(spec.variables)
    ? spec.variables
    : isRecord(spec.templating) && Array.isArray(spec.templating.list)
      ? spec.templating.list
      : [];
  for (const variable of list) {
    if (!isRecord(variable)) {
      continue;
    }
    const name = isRecord(variable.spec) ? variable.spec.name : variable.name;
    if (typeof name === 'string') {
      vars.set(name, variable);
    }
  }
  return vars;
}

function layoutOf(spec: Record<string, unknown>): unknown {
  if (spec.layout !== undefined) {
    return spec.layout;
  }
  if (!Array.isArray(spec.panels)) {
    return undefined;
  }
  const layout: unknown[] = [];
  const visit = (list: unknown[]) => {
    for (const panel of list) {
      if (!isRecord(panel)) {
        continue;
      }
      layout.push([panel.id, panel.gridPos, panel.type === 'row' ? panel.collapsed : undefined]);
      if (Array.isArray(panel.panels)) {
        visit(panel.panels);
      }
    }
  };
  visit(spec.panels);
  return layout;
}
