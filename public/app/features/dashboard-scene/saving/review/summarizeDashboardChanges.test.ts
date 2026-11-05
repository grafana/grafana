import { cloneDeep } from 'lodash';

import {
  defaultPanelKind,
  defaultSpec,
  type PanelKind,
  type Spec as DashboardV2Spec,
} from '@grafana/schema/apis/dashboard.grafana.app/v2';

import { buildStructure } from './structure/buildStructure';
import { summarizeDashboardChanges } from './summarizeDashboardChanges';
import { type RawChange, type ReviewNode, type Structure, type StructureNode } from './types';

jest.mock('./structure/buildStructure', () => ({ buildStructure: jest.fn() }));

const buildStructureMock = jest.mocked(buildStructure);

function panel(title: string, id: number): PanelKind {
  const base = defaultPanelKind();
  return { ...base, spec: { ...base.spec, id, title, description: '' } };
}

function spec(elements: Record<string, PanelKind>, extra: Partial<DashboardV2Spec> = {}): DashboardV2Spec {
  return { ...defaultSpec(), title: 'Service', elements, ...extra };
}

/** A hand-written structure: the dashboard, a 'Cluster' tab holding a 'Nodes' row, and panels. */
function fakeStructure(nodes: StructureNode[], changes: RawChange[] = []): Structure {
  return {
    nodes: [{ id: 'dashboard', kind: 'dashboard', label: 'Dashboard', claims: [] }, ...nodes],
    changes,
    panelNodeId: (name) => nodes.find((node) => node.elementName === name)?.id,
  };
}

const outline = (nodes: ReviewNode[], depth = 0): string[] =>
  nodes.flatMap((node) => [
    `${'  '.repeat(depth)}${node.label}${node.status ? ` (${node.status})` : ''}${node.summary ? ` · ${node.summary}` : ''}`,
    ...(node.kind === 'section' ? outline(node.children, depth + 1) : []),
  ]);

describe('summarizeDashboardChanges', () => {
  const baseline = spec({ 'panel-1': panel('CPU', 1), 'panel-2': panel('Memory', 2) });

  it('keeps a header for the section directly holding a changed panel, and compresses unchanged ancestors', () => {
    buildStructureMock.mockReturnValue(
      fakeStructure([
        { id: 'tab', kind: 'section', sectionKind: 'tab', label: "'Cluster' tab", claims: [] },
        {
          id: 'row',
          kind: 'section',
          sectionKind: 'row',
          label: "'Cluster' tab › 'Nodes' row",
          parentId: 'tab',
          claims: [],
        },
        { id: 'p1', kind: 'panel', label: "'CPU'", parentId: 'row', elementName: 'panel-1', claims: [] },
        { id: 'p2', kind: 'panel', label: "'Memory'", parentId: 'row', elementName: 'panel-2', claims: [] },
      ])
    );
    const payload = cloneDeep(baseline);
    payload.elements['panel-1'].spec.title = 'CPU usage';

    const summary = summarizeDashboardChanges({ mode: 'save', baselineKind: 'saved', baseline, payload });

    expect(outline(summary.tree)).toEqual(["'Cluster' tab › 'Nodes' row", "  'CPU' · properties"]);
    expect(summary.overview).toEqual({
      line: 'Changes to 1 panel',
      counts: { added: 0, changed: 1, removed: 0, moved: 0 },
    });
  });

  it('lists the dashboard first and counts a section with its own changes', () => {
    const changes: RawChange[] = [
      {
        nodeId: 'row',
        category: 'properties',
        field: 'title',
        kind: 'changed',
        before: 'Nodes',
        after: 'Hosts',
        claims: ['layout/spec/rows/0/spec/title'],
      },
    ];
    buildStructureMock.mockReturnValue(
      fakeStructure([{ id: 'row', kind: 'section', sectionKind: 'row', label: "'Hosts' row", claims: [] }], changes)
    );

    const summary = summarizeDashboardChanges({
      mode: 'save',
      baselineKind: 'saved',
      baseline,
      payload: { ...baseline, title: 'Services' },
    });

    expect(outline(summary.tree)).toEqual(['Dashboard · properties', "'Hosts' row · properties"]);
    expect(summary.tree[1].categories[0].changes[0].text).toBe('Title: "Nodes" → "Hosts"');
    expect(summary.overview.line).toBe('Changes to the dashboard and 1 section');
  });

  it('hides what was removed with a removed section and gives its claims to the section', () => {
    buildStructureMock.mockReturnValue(
      fakeStructure([
        {
          id: 'row',
          kind: 'section',
          sectionKind: 'row',
          label: "'Nodes' row",
          status: 'removed',
          removedContents: ["'CPU'"],
          claims: ['layout/spec/rows/0'],
        },
        {
          id: 'p1',
          kind: 'panel',
          label: "'CPU'",
          parentId: 'row',
          elementName: 'panel-1',
          claims: ['elements/panel-1'],
        },
      ])
    );

    const summary = summarizeDashboardChanges({
      mode: 'save',
      baselineKind: 'saved',
      baseline,
      payload: spec({ 'panel-2': panel('Memory', 2) }),
    });

    expect(outline(summary.tree)).toEqual(["'Nodes' row (removed)"]);
    expect(summary.tree[0].claims).toEqual(['layout/spec/rows/0', 'elements/panel-1']);
    expect(summary.overview.counts.removed).toBe(1);
  });

  it('routes an empty layout value the baseline lacked to System defaults', () => {
    buildStructureMock.mockReturnValue(
      fakeStructure(
        [{ id: 'row', kind: 'section', sectionKind: 'row', label: "'Nodes' row", claims: [] }],
        [
          {
            nodeId: 'row',
            category: 'showHide',
            field: 'collapse',
            kind: 'added',
            after: false,
            claims: ['layout/spec/rows/0/spec/collapse'],
          },
        ]
      )
    );
    const withRow = (collapse?: boolean): DashboardV2Spec => ({
      ...baseline,
      layout: {
        kind: 'RowsLayout',
        spec: {
          rows: [
            {
              kind: 'RowsLayoutRow',
              spec: {
                title: 'Nodes',
                ...(collapse === undefined ? {} : { collapse }),
                layout: { kind: 'GridLayout', spec: { items: [] } },
              },
            },
          ],
        },
      },
    });

    const summary = summarizeDashboardChanges({
      mode: 'save',
      baselineKind: 'saved',
      baseline: withRow(),
      payload: withRow(false),
    });

    expect(summary.tree).toEqual([]);
    expect(summary.systemDefaults).toEqual([
      {
        label: "'Nodes' row",
        changes: [{ kind: 'changed', text: 'Row: expanded', claims: ['layout/spec/rows/0/spec/collapse'] }],
      },
    ]);
  });

  it('shows a layout false that differs from its default, and hides a change between two "not set" values', () => {
    const autoGrid = (spec: Record<string, unknown>): DashboardV2Spec => ({
      ...baseline,
      layout: {
        kind: 'AutoGridLayout',
        spec: { maxColumnCount: 3, columnWidthMode: 'standard', rowHeightMode: 'standard', items: [], ...spec },
      },
    });
    buildStructureMock.mockReturnValue(
      fakeStructure(
        [{ id: 'row', kind: 'section', sectionKind: 'row', label: "'Nodes' row", claims: [] }],
        [
          {
            nodeId: 'dashboard',
            category: 'layout',
            field: 'layoutSettings',
            subField: 'matchRowHeights',
            kind: 'added',
            after: false,
            claims: ['layout/spec/matchRowHeights'],
          },
          {
            nodeId: 'row',
            category: 'properties',
            field: 'title',
            kind: 'removed',
            before: '',
            claims: ['layout/spec/title'],
          },
        ]
      )
    );

    const summary = summarizeDashboardChanges({
      mode: 'save',
      baselineKind: 'saved',
      baseline: autoGrid({ title: '' }),
      payload: autoGrid({ matchRowHeights: false }),
    });

    expect(summary.tree.map((node) => node.categories[0]?.changes.map((change) => change.text))).toEqual([
      ['Match row heights: turned off'],
    ]);
    expect(summary.systemDefaults).toEqual([]);
    expect(summary.bookkeeping).toEqual(['layout/spec/title']);
  });

  it('claims bookkeeping without showing it', () => {
    buildStructureMock.mockReturnValue(
      fakeStructure([{ id: 'p1', kind: 'panel', label: "'CPU'", elementName: 'panel-1', claims: [] }])
    );
    const payload = cloneDeep(baseline);
    payload.elements['panel-1'].spec.id = 7;
    payload.revision = 3;

    const summary = summarizeDashboardChanges({ mode: 'save', baselineKind: 'saved', baseline, payload });

    expect(summary.tree).toEqual([]);
    expect(summary.bookkeeping.sort()).toEqual(['elements/panel-1/spec/id', 'revision']);
  });

  it('starts panels collapsed above 10 changed panels', () => {
    const names = Array.from({ length: 11 }, (_, index) => `panel-${index}`);
    const many = spec(Object.fromEntries(names.map((name, index) => [name, panel(`P${index}`, index)])));
    buildStructureMock.mockReturnValue(
      fakeStructure(names.map((name) => ({ id: name, kind: 'panel', label: name, elementName: name, claims: [] })))
    );
    const payload = cloneDeep(many);
    names.forEach((name) => (payload.elements[name].spec.title += ' (new)'));

    const summary = summarizeDashboardChanges({ mode: 'save', baselineKind: 'saved', baseline: many, payload });

    expect(summary.collapsePanelsByDefault).toBe(true);
    expect(summary.overview.line).toBe('Changes to 11 panels');
  });

  it('passes the layout diffs and whole-element adds and removes to the structure', () => {
    buildStructureMock.mockReturnValue(fakeStructure([]));
    const payload = spec({ 'panel-1': panel('CPU', 1), 'panel-3': panel('Disk', 3) });
    payload.layout = { kind: 'GridLayout', spec: { items: [] } };

    summarizeDashboardChanges({ mode: 'save', baselineKind: 'saved', baseline, payload });

    const [, , layoutDiffs] = buildStructureMock.mock.calls[buildStructureMock.mock.calls.length - 1];
    expect(layoutDiffs.map((diff) => diff.path.join('/')).sort()).toEqual(['elements/panel-2', 'elements/panel-3']);
  });
});
