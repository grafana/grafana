import { type PanelKind } from '@grafana/schema/apis/notebook/v2beta1';

import {
  clearCellTimeOverride,
  DEFAULT_NOTEBOOK_TITLE,
  duplicateCellAt,
  insertElement,
  isDefaultNotebookTitle,
  moveCell,
  newCodeElement,
  newMarkdownElement,
  newNotebookSpec,
  newNotebookTitle,
  newNotebookTitleDate,
  newPanelForDatasource,
  nextPanelId,
  normalizeNotebookSpec,
  removeCellAt,
  resolveCells,
  setCellHeight,
  setCellTimeOverride,
  setNotebookTimeRange,
  updateCodeCell,
  updateMarkdownText,
  updatePanelQuery,
  updatePanelTitle,
  updatePanelViz,
} from './notebookSpec';

function newPanelElement(id = 0): PanelKind {
  return {
    kind: 'Panel',
    spec: {
      id,
      title: 'CPU usage',
      links: [],
      data: { kind: 'QueryGroup', spec: { queries: [], transformations: [], queryOptions: {} } },
      vizConfig: {
        kind: 'VizConfig',
        group: 'timeseries',
        version: '',
        spec: { options: {}, fieldConfig: { defaults: {}, overrides: [] } },
      },
    },
  };
}

describe('notebookSpec', () => {
  it('treats blank and legacy untitled titles as the default notebook title', () => {
    expect(DEFAULT_NOTEBOOK_TITLE).toBe('Untitled notebook');
    expect(isDefaultNotebookTitle(DEFAULT_NOTEBOOK_TITLE)).toBe(true);
    expect(isDefaultNotebookTitle('  untitled notebook  ')).toBe(true);
    expect(isDefaultNotebookTitle('')).toBe(true);
    expect(isDefaultNotebookTitle('   ')).toBe(true);
    expect(isDefaultNotebookTitle(undefined)).toBe(true);
    expect(isDefaultNotebookTitle('Checkout latency')).toBe(false);
    expect(isDefaultNotebookTitle(newNotebookTitle())).toBe(false);
  });

  it('names new notebooks with a stable month/day/year + time title', () => {
    const now = new Date('2026-08-01T15:30:00Z');
    // Explicit format (not toLocaleDateString) so titles stay readable across locales.
    expect(newNotebookTitleDate(now)).toMatch(/^[A-Z][a-z]+ \d{1,2}, \d{4} \d{2}:\d{2}$/);
    expect(newNotebookTitle(now)).toBe(`Investigation — ${newNotebookTitleDate(now)}`);
    expect(newNotebookSpec().title.startsWith('Investigation — ')).toBe(true);
  });

  it('normalizes null arrays/maps from API-created notebooks', () => {
    // Go marshals unset slices/maps as null; notebooks created directly through
    // the resource API arrive like this and must not crash the UI.
    const nullish = {
      title: 'api notebook',
      tags: null,
      elements: null,
      timeSettings: { from: 'now-6h', to: 'now', timezone: 'browser', autoRefresh: '', autoRefreshIntervals: null },
      layout: { kind: 'NotebookLayout', spec: { cells: null } },
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- simulating the raw API payload shape
    } as unknown as ReturnType<typeof newNotebookSpec>;

    const spec = normalizeNotebookSpec(nullish);

    expect(spec.tags).toEqual([]);
    expect(spec.elements).toEqual({});
    expect(spec.layout.spec.cells).toEqual([]);
    expect(Array.isArray(spec.timeSettings.autoRefreshIntervals)).toBe(true);
    expect(spec.timeSettings.autoRefreshIntervals!.length).toBeGreaterThan(0);
    expect(resolveCells(spec)).toEqual([]);
  });

  it('updates one query of a panel element, stripping runtime-only keys', () => {
    const base = newNotebookSpec('nb');
    const panel = newPanelForDatasource({ uid: 'ds-uid', type: 'prometheus' });
    const { spec, elementName } = insertElement(base, panel);

    const updated = updatePanelQuery(spec, elementName, 'A', {
      refId: 'A',
      datasource: { uid: 'ds-uid', type: 'prometheus' },
      hide: false,
      expr: 'up',
      instant: true,
    });

    const element = updated.elements[elementName];
    if (element.kind !== 'Panel') {
      throw new Error('expected panel element');
    }
    const query = element.spec.data.spec.queries[0];
    expect(query.spec.refId).toBe('A');
    expect(query.spec.query.spec).toEqual({ expr: 'up', instant: true });
    // Datasource wiring on the envelope is untouched.
    expect(query.spec.query.datasource?.name).toBe('ds-uid');
    expect(query.spec.query.group).toBe('prometheus');
    // Unknown refIds leave the spec unchanged.
    expect(updatePanelQuery(updated, elementName, 'Z', { expr: 'down' })).toEqual(updated);
  });

  it('creates an empty notebook with the requested time range', () => {
    const spec = newNotebookSpec('My investigation', { from: 'now-1h', to: 'now' });

    expect(spec.title).toBe('My investigation');
    expect(spec.timeSettings.from).toBe('now-1h');
    expect(spec.timeSettings.to).toBe('now');
    expect(spec.layout.spec.cells).toHaveLength(0);
    expect(Object.keys(spec.elements)).toHaveLength(0);
  });

  it('inserts elements and keeps layout order', () => {
    let spec = newNotebookSpec('nb');
    const first = insertElement(spec, newMarkdownElement('# Findings'));
    const second = insertElement(first.spec, newCodeElement('sql', 'SELECT 1'), { source: 'assistant' });
    spec = second.spec;

    const cells = resolveCells(spec);
    expect(cells).toHaveLength(2);
    expect(cells[0].elementName).toBe(first.elementName);
    expect(cells[1].elementName).toBe(second.elementName);
    expect(cells[1].source).toBe('assistant');
  });

  it('inserts at a specific index', () => {
    let spec = newNotebookSpec('nb');
    const a = insertElement(spec, newMarkdownElement('a'));
    const b = insertElement(a.spec, newMarkdownElement('b'));
    const middle = insertElement(b.spec, newMarkdownElement('middle'), { index: 1 });

    const order = resolveCells(middle.spec).map((c) => c.elementName);
    expect(order).toEqual([a.elementName, middle.elementName, b.elementName]);
  });

  it('assigns unique ids to inserted panels', () => {
    let spec = newNotebookSpec('nb');
    const first = insertElement(spec, newPanelElement());
    const second = insertElement(first.spec, newPanelElement());
    spec = second.spec;

    const firstPanel = spec.elements[first.elementName];
    const secondPanel = spec.elements[second.elementName];
    if (firstPanel.kind !== 'Panel' || secondPanel.kind !== 'Panel') {
      throw new Error('expected panels');
    }
    expect(firstPanel.spec.id).toBe(1);
    expect(secondPanel.spec.id).toBe(2);
    expect(nextPanelId(spec)).toBe(3);
  });

  it('removes a cell and its unreferenced element', () => {
    let spec = newNotebookSpec('nb');
    const a = insertElement(spec, newMarkdownElement('a'));
    const b = insertElement(a.spec, newMarkdownElement('b'));
    spec = removeCellAt(b.spec, 0);

    expect(resolveCells(spec)).toHaveLength(1);
    expect(spec.elements[a.elementName]).toBeUndefined();
    expect(spec.elements[b.elementName]).toBeDefined();
  });

  it('moves cells within bounds and ignores out-of-range moves', () => {
    let spec = newNotebookSpec('nb');
    const a = insertElement(spec, newMarkdownElement('a'));
    const b = insertElement(a.spec, newMarkdownElement('b'));
    const c = insertElement(b.spec, newMarkdownElement('c'));
    spec = c.spec;

    const moved = moveCell(spec, 2, 0);
    expect(resolveCells(moved).map((x) => x.elementName)).toEqual([c.elementName, a.elementName, b.elementName]);

    expect(moveCell(spec, 5, 0)).toBe(spec);
    expect(moveCell(spec, 0, 0)).toBe(spec);
  });

  it('updates markdown and code cells immutably', () => {
    let spec = newNotebookSpec('nb');
    const md = insertElement(spec, newMarkdownElement('old'));
    const code = insertElement(md.spec, newCodeElement('sql', 'SELECT 1'));
    spec = code.spec;

    const updated = updateCodeCell(updateMarkdownText(spec, md.elementName, 'new'), code.elementName, {
      code: 'SELECT 2',
    });

    const mdElement = updated.elements[md.elementName];
    const codeElement = updated.elements[code.elementName];
    if (mdElement.kind !== 'Cell' || mdElement.spec.content.kind !== 'Markdown') {
      throw new Error('expected markdown cell');
    }
    if (codeElement.kind !== 'Cell' || codeElement.spec.content.kind !== 'Code') {
      throw new Error('expected code cell');
    }
    expect(mdElement.spec.content.spec.text).toBe('new');
    expect(codeElement.spec.content.spec.code).toBe('SELECT 2');
    expect(codeElement.spec.content.spec.language).toBe('sql');

    // original untouched
    const originalMd = spec.elements[md.elementName];
    if (originalMd.kind !== 'Cell' || originalMd.spec.content.kind !== 'Markdown') {
      throw new Error('expected markdown cell');
    }
    expect(originalMd.spec.content.spec.text).toBe('old');
  });

  it('updates the time range without dropping other settings', () => {
    const spec = newNotebookSpec('nb');
    const updated = setNotebookTimeRange(spec, 'now-24h', 'now');
    expect(updated.timeSettings.from).toBe('now-24h');
    expect(updated.timeSettings.to).toBe('now');
    expect(updated.timeSettings.autoRefreshIntervals).toEqual(spec.timeSettings.autoRefreshIntervals);
  });

  it('duplicates a cell with a fresh element name and unique panel id', () => {
    let spec = newNotebookSpec('nb');
    const md = insertElement(spec, newMarkdownElement('copy me'));
    const panel = insertElement(md.spec, newPanelElement());
    spec = setCellHeight(panel.spec, 1, 480);

    const duplicated = duplicateCellAt(spec, 1);
    const cells = resolveCells(duplicated);

    expect(cells).toHaveLength(3);
    expect(cells[2].elementName).not.toBe(panel.elementName);
    expect(cells[2].height).toBe(480);
    const original = duplicated.elements[panel.elementName];
    const copy = duplicated.elements[cells[2].elementName];
    if (original.kind !== 'Panel' || copy.kind !== 'Panel') {
      throw new Error('expected panels');
    }
    expect(copy.spec.title).toBe(original.spec.title);
    expect(copy.spec.id).not.toBe(original.spec.id);

    // duplicating an out-of-range index is a no-op
    expect(duplicateCellAt(duplicated, 99)).toBe(duplicated);
  });

  it('sets height on layout items', () => {
    let spec = newNotebookSpec('nb');
    spec = insertElement(spec, newMarkdownElement('a')).spec;

    const sized = setCellHeight(spec, 0, 456.7);
    expect(resolveCells(sized)[0].height).toBe(457);

    expect(setCellHeight(sized, 5, 100)).toBe(sized);
  });

  it('renames panel elements only', () => {
    let spec = newNotebookSpec('nb');
    const md = insertElement(spec, newMarkdownElement('a'));
    const panel = insertElement(md.spec, newPanelElement());
    spec = panel.spec;

    const renamed = updatePanelTitle(spec, panel.elementName, 'Renamed panel');
    const element = renamed.elements[panel.elementName];
    if (element.kind !== 'Panel') {
      throw new Error('expected panel');
    }
    expect(element.spec.title).toBe('Renamed panel');

    expect(updatePanelTitle(spec, md.elementName, 'nope')).toBe(spec);
    expect(updatePanelTitle(spec, 'missing', 'nope')).toBe(spec);
  });

  it('locks and unlocks a per-cell time range', () => {
    let spec = newNotebookSpec('nb');
    spec = insertElement(spec, newPanelElement()).spec;

    const locked = setCellTimeOverride(spec, 0, '2026-07-31T16:00:00Z', '2026-07-31T17:00:00Z');
    const lockedCell = resolveCells(locked)[0];
    expect(lockedCell.timeFrom).toBe('2026-07-31T16:00:00Z');
    expect(lockedCell.timeTo).toBe('2026-07-31T17:00:00Z');

    const unlocked = clearCellTimeOverride(locked, 0);
    const unlockedCell = resolveCells(unlocked)[0];
    expect(unlockedCell.timeFrom).toBeUndefined();
    expect(unlockedCell.timeTo).toBeUndefined();
  });

  it('inserts elements with a time override', () => {
    const spec = newNotebookSpec('nb');
    const { spec: withPanel } = insertElement(spec, newPanelElement(), {
      timeOverride: { from: '2026-07-31T16:00:00Z', to: '2026-07-31T17:00:00Z' },
    });
    const cell = resolveCells(withPanel)[0];
    expect(cell.timeFrom).toBe('2026-07-31T16:00:00Z');
    expect(cell.timeTo).toBe('2026-07-31T17:00:00Z');
  });

  it('swaps a panel visualization while keeping queries', () => {
    let spec = newNotebookSpec('nb');
    const panel = insertElement(spec, newPanelElement());
    spec = panel.spec;

    const swapped = updatePanelViz(spec, panel.elementName, {
      pluginId: 'stat',
      options: { textMode: 'auto' },
    });

    const element = swapped.elements[panel.elementName];
    if (element.kind !== 'Panel') {
      throw new Error('expected panel');
    }
    expect(element.spec.vizConfig.group).toBe('stat');
    expect(element.spec.vizConfig.spec.options).toEqual({ textMode: 'auto' });
    expect(element.spec.data.spec.queries).toEqual(
      (() => {
        const original = spec.elements[panel.elementName];
        return original.kind === 'Panel' ? original.spec.data.spec.queries : [];
      })()
    );

    expect(updatePanelViz(spec, 'missing', { pluginId: 'stat' })).toBe(spec);
  });

  it('drops dangling element references when resolving cells', () => {
    let spec = newNotebookSpec('nb');
    const a = insertElement(spec, newMarkdownElement('a'));
    spec = {
      ...a.spec,
      layout: {
        ...a.spec.layout,
        spec: {
          cells: [
            ...a.spec.layout.spec.cells,
            {
              kind: 'NotebookLayoutItem',
              spec: { element: { kind: 'ElementReference', name: 'missing' }, source: 'user' },
            },
          ],
        },
      },
    };

    expect(resolveCells(spec)).toHaveLength(1);
  });
});
