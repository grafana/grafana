import { nanoid } from 'nanoid';

import { dateTimeFormat } from '@grafana/data';
import {
  defaultTimeSettingsSpec,
  type CellKind,
  type NotebookElement,
  type NotebookLayoutItemKind,
  type PanelKind,
  type Spec as NotebookSpec,
} from '@grafana/schema/apis/notebook/v2beta1';

export type CellSource = NotebookLayoutItemKind['spec']['source'];

type NotebookLayoutItemSpecWithPresentation = NotebookLayoutItemKind['spec'] & {
  height?: number;
  timeFrom?: string;
  timeTo?: string;
};

/** A notebook cell paired with the element it references, resolved for rendering/editing. */
export interface ResolvedCell {
  /** Element name in the spec's elements map — also used as the stable React key. */
  elementName: string;
  source: CellSource;
  collapsed?: boolean;
  /** Rendered height in pixels for panel cells. */
  height?: number;
  /** When both set, the panel is locked to this time range instead of the notebook's. */
  timeFrom?: string;
  timeTo?: string;
  element: NotebookElement;
}

/**
 * Repairs specs that arrive from the API with `null` where the UI expects arrays/maps.
 * Go marshals unset slices and maps as `null` (no omitempty), so notebooks created
 * directly through the resource API — rather than this UI — need this on load.
 */
export function normalizeNotebookSpec(spec: NotebookSpec): NotebookSpec {
  return {
    ...spec,
    tags: spec.tags ?? [],
    elements: spec.elements ?? {},
    timeSettings: {
      ...spec.timeSettings,
      autoRefreshIntervals: spec.timeSettings.autoRefreshIntervals ?? defaultTimeSettingsSpec().autoRefreshIntervals,
    },
    layout: {
      ...spec.layout,
      spec: { ...spec.layout.spec, cells: spec.layout.spec.cells ?? [] },
    },
  };
}

/**
 * Legacy / empty-title fallback shown in the editor when a notebook has no name.
 * New notebooks are created with {@link newNotebookTitle} instead.
 */
export const DEFAULT_NOTEBOOK_TITLE = 'Untitled notebook';

/** True when the title is missing/blank or still the legacy untitled placeholder. */
export function isDefaultNotebookTitle(title: string | undefined | null): boolean {
  const trimmed = title?.trim() ?? '';
  return !trimmed || trimmed.toLowerCase() === DEFAULT_NOTEBOOK_TITLE.toLowerCase();
}

/**
 * Stable date/time segment for {@link newNotebookTitle} (also for i18n `{{date}}`).
 * Uses an explicit month/day/year + time format so locale quirks from
 * `toLocaleDateString()` don't produce unreadable titles.
 */
export function newNotebookTitleDate(now: Date = new Date()): string {
  return dateTimeFormat(now, { format: 'MMMM D, YYYY HH:mm', timeZone: 'browser' });
}

/**
 * Title for newly created notebooks — dated so capture/quick-add targets are easy
 * to find later (list, sidebar, command palette, add-to-notebook).
 * Example: `Investigation — August 1, 2026 16:30`
 */
export function newNotebookTitle(now: Date = new Date()): string {
  return `Investigation — ${newNotebookTitleDate(now)}`;
}

export function newNotebookSpec(
  title: string = newNotebookTitle(),
  options?: { description?: string; from?: string; to?: string }
): NotebookSpec {
  const timeSettings = defaultTimeSettingsSpec();
  if (options?.from) {
    timeSettings.from = options.from;
  }
  if (options?.to) {
    timeSettings.to = options.to;
  }

  return {
    title,
    description: options?.description,
    tags: [],
    timeSettings,
    elements: {},
    layout: { kind: 'NotebookLayout', spec: { cells: [] } },
  };
}

export function newMarkdownElement(text = ''): CellKind {
  return { kind: 'Cell', spec: { content: { kind: 'Markdown', spec: { text } } } };
}

export function newCodeElement(language = '', code = ''): CellKind {
  return { kind: 'Cell', spec: { content: { kind: 'Code', spec: { language, code } } } };
}

/** The visualization that best fits what a datasource type typically returns. */
function defaultVizForDatasource(datasourceType: string): string {
  switch (datasourceType) {
    case 'loki':
      return 'logs';
    case 'tempo':
    case 'jaeger':
    case 'zipkin':
      return 'traces';
    case 'grafana-pyroscope-datasource':
    case 'parca':
      return 'flamegraph';
    case 'mysql':
    case 'postgres':
    case 'mssql':
      return 'table';
    default:
      return 'timeseries';
  }
}

/**
 * A fresh panel wired to a datasource with one empty query — the in-editor
 * "Add visualization" starting point. The id is reassigned on insert.
 */
export function newPanelForDatasource(
  datasource: { uid: string; type: string },
  options?: { title?: string; querySpec?: Record<string, unknown>; vizType?: string }
): PanelKind {
  return {
    kind: 'Panel',
    spec: {
      id: 0,
      title: options?.title ?? '',
      links: [],
      data: {
        kind: 'QueryGroup',
        spec: {
          queries: [
            {
              kind: 'PanelQuery',
              spec: {
                refId: 'A',
                hidden: false,
                query: {
                  kind: 'DataQuery',
                  group: datasource.type,
                  version: 'v0',
                  datasource: { name: datasource.uid },
                  spec: options?.querySpec ?? {},
                },
              },
            },
          ],
          transformations: [],
          queryOptions: {},
        },
      },
      vizConfig: {
        kind: 'VizConfig',
        group: options?.vizType ?? defaultVizForDatasource(datasource.type),
        version: '',
        spec: { options: {}, fieldConfig: { defaults: {}, overrides: [] } },
      },
    },
  };
}

/**
 * Replaces one query of a panel element with an edited data query. The runtime-only
 * keys (refId, datasource, hide) live on the query envelope, not in the stored spec.
 * When `datasource` is provided the envelope's datasource wiring is updated too.
 */
export function updatePanelQuery(
  spec: NotebookSpec,
  elementName: string,
  refId: string,
  dataQuery: Record<string, unknown>,
  datasource?: { uid: string; type: string }
): NotebookSpec {
  const element = spec.elements[elementName];
  if (!element || element.kind !== 'Panel') {
    return spec;
  }

  const { refId: _refId, datasource: _datasource, hide: _hide, ...querySpec } = dataQuery;

  const queries = element.spec.data.spec.queries.map((query) =>
    query.spec.refId === refId
      ? {
          ...query,
          spec: {
            ...query.spec,
            query: {
              ...query.spec.query,
              ...(datasource ? { group: datasource.type, datasource: { name: datasource.uid } } : {}),
              spec: querySpec,
            },
          },
        }
      : query
  );

  return {
    ...spec,
    elements: {
      ...spec.elements,
      [elementName]: {
        ...element,
        spec: {
          ...element.spec,
          data: { ...element.spec.data, spec: { ...element.spec.data.spec, queries } },
        },
      },
    },
  };
}

/** Panel ids must be unique within a notebook: scene panel keys are derived from them. */
export function nextPanelId(spec: NotebookSpec): number {
  let max = 0;
  for (const element of Object.values(spec.elements)) {
    if (element.kind === 'Panel' || element.kind === 'LibraryPanel') {
      max = Math.max(max, element.spec.id);
    }
  }
  return max + 1;
}

function elementNamePrefix(element: NotebookElement): string {
  if (element.kind === 'Panel' || element.kind === 'LibraryPanel') {
    return 'panel';
  }
  return element.spec.content.kind === 'Code' ? 'code' : 'md';
}

/**
 * Adds an element to the notebook and references it from a new layout cell.
 * Panels get a fresh unique numeric id. Returns the new spec and the generated
 * element name (which doubles as the cell key).
 */
export function insertElement(
  spec: NotebookSpec,
  element: NotebookElement,
  options?: { source?: CellSource; index?: number; timeOverride?: { from: string; to: string } }
): { spec: NotebookSpec; elementName: string } {
  const elementName = `${elementNamePrefix(element)}-${nanoid(8)}`;

  let toInsert = element;
  if (element.kind === 'Panel') {
    toInsert = { ...element, spec: { ...element.spec, id: nextPanelId(spec) } };
  } else if (element.kind === 'LibraryPanel') {
    toInsert = { ...element, spec: { ...element.spec, id: nextPanelId(spec) } };
  }

  const cell: NotebookLayoutItemKind = {
    kind: 'NotebookLayoutItem',
    spec: {
      element: { kind: 'ElementReference', name: elementName },
      source: options?.source ?? 'user',
      ...(options?.timeOverride ? { timeFrom: options.timeOverride.from, timeTo: options.timeOverride.to } : {}),
    },
  };

  const cells = [...spec.layout.spec.cells];
  const index = options?.index ?? cells.length;
  cells.splice(Math.max(0, Math.min(index, cells.length)), 0, cell);

  return {
    spec: {
      ...spec,
      elements: { ...spec.elements, [elementName]: toInsert },
      layout: { ...spec.layout, spec: { cells } },
    },
    elementName,
  };
}

/** Removes the layout cell at `index` and its element when nothing else references it. */
export function removeCellAt(spec: NotebookSpec, index: number): NotebookSpec {
  const cells = spec.layout.spec.cells;
  const cell = cells[index];
  if (!cell) {
    return spec;
  }

  const remaining = cells.filter((_, i) => i !== index);
  const elementName = cell.spec.element.name;
  const stillReferenced = remaining.some((c) => c.spec.element.name === elementName);

  let elements = spec.elements;
  if (!stillReferenced) {
    elements = { ...spec.elements };
    delete elements[elementName];
  }

  return { ...spec, elements, layout: { ...spec.layout, spec: { cells: remaining } } };
}

export function moveCell(spec: NotebookSpec, from: number, to: number): NotebookSpec {
  const cells = [...spec.layout.spec.cells];
  if (from < 0 || from >= cells.length || to < 0 || to >= cells.length || from === to) {
    return spec;
  }
  const [cell] = cells.splice(from, 1);
  cells.splice(to, 0, cell);
  return { ...spec, layout: { ...spec.layout, spec: { cells } } };
}

/** Deep-copies the cell at `index` (element included) and inserts the copy right below it. */
export function duplicateCellAt(spec: NotebookSpec, index: number): NotebookSpec {
  const cell = spec.layout.spec.cells[index];
  const element = cell && spec.elements[cell.spec.element.name];
  if (!cell || !element) {
    return spec;
  }

  const cellSpec: NotebookLayoutItemSpecWithPresentation = cell.spec;

  const copy: NotebookElement = JSON.parse(JSON.stringify(element));
  const { spec: withCopy, elementName } = insertElement(spec, copy, {
    source: cellSpec.source,
    index: index + 1,
  });

  // Carry over the layout-item presentation (collapsed/height/time lock) onto the new cell.
  const cells = withCopy.layout.spec.cells.map((item) =>
    item.spec.element.name === elementName
      ? {
          ...item,
          spec: {
            ...item.spec,
            collapsed: cellSpec.collapsed,
            height: cellSpec.height,
            timeFrom: cellSpec.timeFrom,
            timeTo: cellSpec.timeTo,
          },
        }
      : item
  );

  return { ...withCopy, layout: { ...withCopy.layout, spec: { cells } } };
}

function updateLayoutItemAt(
  spec: NotebookSpec,
  index: number,
  changes: Partial<Pick<NotebookLayoutItemSpecWithPresentation, 'collapsed' | 'height' | 'timeFrom' | 'timeTo'>>
): NotebookSpec {
  const cells = spec.layout.spec.cells;
  if (!cells[index]) {
    return spec;
  }
  const updated = cells.map((item, i) => (i === index ? { ...item, spec: { ...item.spec, ...changes } } : item));
  return { ...spec, layout: { ...spec.layout, spec: { cells: updated } } };
}

export function setCellHeight(spec: NotebookSpec, index: number, height: number): NotebookSpec {
  return updateLayoutItemAt(spec, index, { height: Math.round(height) });
}

/** Locks a panel cell to its own time range instead of the notebook's global one. */
export function setCellTimeOverride(spec: NotebookSpec, index: number, from: string, to: string): NotebookSpec {
  return updateLayoutItemAt(spec, index, { timeFrom: from, timeTo: to });
}

/** Syncs a panel cell back to the notebook's global time range. */
export function clearCellTimeOverride(spec: NotebookSpec, index: number): NotebookSpec {
  return updateLayoutItemAt(spec, index, { timeFrom: undefined, timeTo: undefined });
}

/** Swaps a panel's visualization (from a suggestion), keeping its queries. */
export function updatePanelViz(
  spec: NotebookSpec,
  elementName: string,
  viz: { pluginId: string; options?: unknown; fieldConfig?: unknown }
): NotebookSpec {
  const element = spec.elements[elementName];
  if (!element || element.kind !== 'Panel') {
    return spec;
  }
  return {
    ...spec,
    elements: {
      ...spec.elements,
      [elementName]: {
        ...element,
        spec: {
          ...element.spec,
          vizConfig: {
            kind: 'VizConfig',
            group: viz.pluginId,
            version: '',
            spec: {
              // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- suggestion options/fieldConfig are stored as-is, same seam as dashboard capture
              options: (viz.options ?? {}) as Record<string, unknown>,
              // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- suggestion options/fieldConfig are stored as-is, same seam as dashboard capture
              fieldConfig: (viz.fieldConfig ?? {
                defaults: {},
                overrides: [],
              }) as PanelKind['spec']['vizConfig']['spec']['fieldConfig'],
            },
          },
        },
      },
    },
  };
}

export function updatePanelTitle(spec: NotebookSpec, elementName: string, title: string): NotebookSpec {
  const element = spec.elements[elementName];
  if (!element || element.kind !== 'Panel') {
    return spec;
  }
  return {
    ...spec,
    elements: { ...spec.elements, [elementName]: { ...element, spec: { ...element.spec, title } } },
  };
}

export function updateMarkdownText(spec: NotebookSpec, elementName: string, text: string): NotebookSpec {
  const element = spec.elements[elementName];
  if (!element || element.kind !== 'Cell' || element.spec.content.kind !== 'Markdown') {
    return spec;
  }
  const updated: CellKind = { ...element, spec: { content: { kind: 'Markdown', spec: { text } } } };
  return { ...spec, elements: { ...spec.elements, [elementName]: updated } };
}

export function updateCodeCell(
  spec: NotebookSpec,
  elementName: string,
  changes: { language?: string; code?: string }
): NotebookSpec {
  const element = spec.elements[elementName];
  if (!element || element.kind !== 'Cell' || element.spec.content.kind !== 'Code') {
    return spec;
  }
  const content = element.spec.content;
  const updated: CellKind = {
    ...element,
    spec: {
      content: {
        kind: 'Code',
        spec: {
          ...content.spec,
          language: changes.language ?? content.spec.language,
          code: changes.code ?? content.spec.code,
        },
      },
    },
  };
  return { ...spec, elements: { ...spec.elements, [elementName]: updated } };
}

export function setNotebookTitle(spec: NotebookSpec, title: string): NotebookSpec {
  return { ...spec, title };
}

export function setNotebookTimeRange(spec: NotebookSpec, from: string, to: string): NotebookSpec {
  return { ...spec, timeSettings: { ...spec.timeSettings, from, to } };
}

/** Resolves layout cells against the elements map, dropping dangling references. */
export function resolveCells(spec: NotebookSpec): ResolvedCell[] {
  const result: ResolvedCell[] = [];
  for (const cell of spec.layout.spec.cells) {
    const cellSpec: NotebookLayoutItemSpecWithPresentation = cell.spec;
    const elementName = cellSpec.element.name;
    const element = spec.elements[elementName];
    if (!element) {
      continue;
    }
    result.push({
      elementName,
      source: cellSpec.source,
      collapsed: cellSpec.collapsed,
      height: cellSpec.height,
      timeFrom: cellSpec.timeFrom,
      timeTo: cellSpec.timeTo,
      element,
    });
  }
  return result;
}
