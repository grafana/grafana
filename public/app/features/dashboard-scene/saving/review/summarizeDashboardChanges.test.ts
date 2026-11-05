import { cloneDeep } from 'lodash';

import {
  defaultPanelKind,
  defaultSpec,
  type PanelKind,
  type Spec as DashboardV2Spec,
} from '@grafana/schema/apis/dashboard.grafana.app/v2';

import { joinPath, named, richToPlain } from './richText';
import { buildStructure } from './structure/buildStructure';
import { summarizeDashboardChanges } from './summarizeDashboardChanges';
import { type RawChange, type ReviewNode, type RichText, type Structure, type StructureNode } from './types';

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
    nodes: [{ id: 'dashboard', kind: 'dashboard', claims: [] }, ...nodes],
    changes,
    panelNodeId: (name) => nodes.find((node) => node.elementName === name)?.id,
  };
}

const tab = (title: string) => [named('tab', title)];
const row = (title: string) => [named('row', title)];
const panelName = (title: string) => [named('panel', title)];

const outline = (nodes: ReviewNode[], depth = 0): string[] =>
  nodes.flatMap((node) => [
    [
      '  '.repeat(depth) + richToPlain(node.label),
      node.statusText ? ` ${richToPlain(node.statusText)}` : '',
      node.summary ? ` · ${node.summary}` : '',
    ].join(''),
    ...(node.kind === 'section' ? outline(node.children, depth + 1) : []),
  ]);

describe('summarizeDashboardChanges', () => {
  const baseline = spec({ 'panel-1': panel('CPU', 1), 'panel-2': panel('Memory', 2) });

  it('keeps a header for the section directly holding a changed panel, and compresses unchanged ancestors', () => {
    buildStructureMock.mockReturnValue(
      fakeStructure([
        { id: 'tab', kind: 'section', sectionKind: 'tab', name: tab('Cluster'), claims: [] },
        {
          id: 'row',
          kind: 'section',
          sectionKind: 'row',
          name: row('Nodes'),
          parentPath: tab('Cluster'),
          parentId: 'tab',
          claims: [],
        },
        { id: 'p1', kind: 'panel', name: panelName('CPU'), parentId: 'row', elementName: 'panel-1', claims: [] },
        { id: 'p2', kind: 'panel', name: panelName('Memory'), parentId: 'row', elementName: 'panel-2', claims: [] },
      ])
    );
    const payload = cloneDeep(baseline);
    payload.elements['panel-1'].spec.title = 'CPU usage';

    const summary = summarizeDashboardChanges({ mode: 'save', baselineKind: 'saved', baseline, payload });

    // The tab isn't shown, so the row says where it is.
    expect(outline(summary.tree)).toEqual([
      'Row "Nodes" under Tab "Cluster"',
      '  Panel "CPU" was updated (1 change) · properties',
    ]);
    expect(summary.overview).toEqual({
      line: 'Changes to 1 tab',
      counts: { added: 0, changed: 1, removed: 0, moved: 0 },
    });
  });

  it('drops "under" when the tree shows the direct parent', () => {
    const changes: RawChange[] = [
      {
        nodeId: 'tab',
        category: 'properties',
        field: 'title',
        kind: 'changed',
        before: 'Old',
        after: 'Cluster',
        claims: ['layout/spec/tabs/0/spec/title'],
      },
    ];
    buildStructureMock.mockReturnValue(
      fakeStructure(
        [
          { id: 'tab', kind: 'section', sectionKind: 'tab', name: tab('Cluster'), claims: [] },
          {
            id: 'row',
            kind: 'section',
            sectionKind: 'row',
            name: row('Nodes'),
            parentPath: tab('Cluster'),
            parentId: 'tab',
            claims: [],
          },
          { id: 'p1', kind: 'panel', name: panelName('CPU'), parentId: 'row', elementName: 'panel-1', claims: [] },
        ],
        changes
      )
    );
    const payload = cloneDeep(baseline);
    payload.elements['panel-1'].spec.title = 'CPU usage';

    const summary = summarizeDashboardChanges({ mode: 'save', baselineKind: 'saved', baseline, payload });

    expect(outline(summary.tree)).toEqual([
      'Tab "Cluster" was updated (1 change) · properties',
      '  Row "Nodes"',
      '    Panel "CPU" was updated (1 change) · properties',
    ]);
  });

  it.each([
    ['added', 1, 'Added Row "New" under Tab "Cluster"'],
    ['added', 2, 'Added Row "New" under Tab "Cluster" › Row "Nodes"'],
    ['removed', 1, 'Removed Tab "New" under Tab "Cluster"'],
    ['removed', 3, 'Removed Tab "New" under Tab "Cluster" › Row "Nodes" › Tab "Deep"'],
  ] as const)(
    'names a %s section at depth %s, with its whole path when its parents are compressed',
    (status, depth, header) => {
      const path = [tab('Cluster'), row('Nodes'), tab('Deep')].slice(0, depth);
      const ancestors = path.map((name, index) => ({
        id: `s${index}`,
        kind: 'section' as const,
        sectionKind: name[0].kind === 'tab' ? ('tab' as const) : ('row' as const),
        name,
        parentId: index ? `s${index - 1}` : undefined,
        claims: [],
      }));
      const parentPath = path.slice(1).reduce<RichText>((all, name) => joinPath(all, name), path[0]);
      buildStructureMock.mockReturnValue(
        fakeStructure([
          ...ancestors,
          {
            id: 'new',
            kind: 'section',
            sectionKind: status === 'added' ? 'row' : 'tab',
            name: status === 'added' ? row('New') : tab('New'),
            parentPath,
            parentId: `s${depth - 1}`,
            status,
            claims: [],
          },
        ])
      );

      const summary = summarizeDashboardChanges({ mode: 'save', baselineKind: 'saved', baseline, payload: baseline });

      expect(outline(summary.tree)).toEqual([header]);
    }
  );

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
      fakeStructure([{ id: 'row', kind: 'section', sectionKind: 'row', name: row('Hosts'), claims: [] }], changes)
    );

    const summary = summarizeDashboardChanges({
      mode: 'save',
      baselineKind: 'saved',
      baseline,
      payload: { ...baseline, title: 'Services' },
    });

    expect(outline(summary.tree)).toEqual([
      'Dashboard was updated (1 change) · properties',
      'Row "Hosts" was updated (1 change) · properties',
    ]);
    expect(summary.tree[1].categories[0].changes[0].text).toBe('Title: "Nodes" → "Hosts"');
    expect(summary.overview.line).toBe('Changes to the dashboard and 1 row');
  });

  it('hides what was removed with a removed section and gives its claims to the section', () => {
    buildStructureMock.mockReturnValue(
      fakeStructure([
        {
          id: 'row',
          kind: 'section',
          sectionKind: 'row',
          name: row('Nodes'),
          status: 'removed',
          removedContents: [panelName('CPU')],
          claims: ['layout/spec/rows/0'],
        },
        {
          id: 'p1',
          kind: 'panel',
          name: panelName('CPU'),
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

    expect(outline(summary.tree)).toEqual(['Removed Row "Nodes"']);
    expect(summary.tree[0].claims).toEqual(['layout/spec/rows/0', 'elements/panel-1']);
    expect(summary.overview.counts.removed).toBe(1);
  });

  it('routes an empty layout value the baseline lacked to System defaults', () => {
    buildStructureMock.mockReturnValue(
      fakeStructure(
        [{ id: 'row', kind: 'section', sectionKind: 'row', name: row('Nodes'), claims: [] }],
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
        label: [{ ...named('row', 'Nodes'), self: true }],
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
        [{ id: 'row', kind: 'section', sectionKind: 'row', name: row('Nodes'), claims: [] }],
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
      fakeStructure([{ id: 'p1', kind: 'panel', name: panelName('CPU'), elementName: 'panel-1', claims: [] }])
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
      fakeStructure(
        names.map((name) => ({ id: name, kind: 'panel', name: panelName(name), elementName: name, claims: [] }))
      )
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
