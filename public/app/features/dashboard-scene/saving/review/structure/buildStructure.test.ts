import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';

import {
  autoGrid,
  autoGridItem,
  dashboard,
  grid,
  gridItem,
  gridOf,
  type Layout,
  libraryPanel,
  panel,
  row,
  rows,
  stackOf,
  tab,
  tabs,
} from '../__corpus__/builders';
import { panelNodeId } from '../types';

import { buildStructure } from './buildStructure';
import { changeList, claimProblems, layoutDiffsOf, plainNodes, outline, structureOf } from './testUtils';

const panels = { a: 'CPU', b: 'Memory', c: 'Disk', d: 'Network', e: 'Errors' };

/** A dashboard with the given layout and panels (element name → title). */
function dashboardOf(layout: Layout, titles: Record<string, string>): DashboardV2Spec {
  return dashboard({
    elements: Object.fromEntries(Object.entries(titles).map(([name, title], i) => [name, panel(title, { id: i + 1 })])),
    layout,
  });
}

/** The test panels with the given element names. */
function only(...names: Array<keyof typeof panels>): Record<string, string> {
  return Object.fromEntries(names.map((name) => [name, panels[name]]));
}

function nodeByLabel(structure: ReturnType<typeof structureOf>, label: string) {
  const node = plainNodes(structure).find((n) => n.label === label);
  if (!node) {
    throw new Error(`No node labelled ${label}: ${outline(structure).join(' | ')}`);
  }
  return node;
}

describe('buildStructure', () => {
  describe('nodes', () => {
    it('lists the dashboard, then every section and panel of either side', () => {
      const layout = rows([row('API', gridOf('a', 'b')), row('DB', gridOf('c'))]);
      const structure = structureOf(dashboardOf(layout, panels), dashboardOf(layout, panels));

      expect(outline(structure)).toEqual([
        'Dashboard',
        'Row "API"',
        '  Panel "CPU"',
        '  Panel "Memory"',
        'Row "DB"',
        '  Panel "Disk"',
        // Elements with no placement come last.
        'Panel "Network"',
        'Panel "Errors"',
      ]);
      expect(structure.changes).toEqual([]);
      // describe/ attributes an element's diffs to this id without looking it up.
      const panelIds = structure.nodes.filter((node) => node.kind === 'panel').map((node) => node.id);
      expect(panelIds).toEqual(Object.keys(panels).map(panelNodeId));
    });

    it('gives stable ids, with parents for nesting', () => {
      const layout = tabs([tab('Cluster', rows([row('Nodes', gridOf('a'))]))]);
      const structure = structureOf(dashboardOf(layout, { a: 'CPU' }), dashboardOf(layout, { a: 'CPU' }));

      expect(structure.nodes.map((n) => [n.id, n.kind, n.sectionKind, n.parentId])).toEqual([
        ['dashboard', 'dashboard', undefined, undefined],
        ['section:layout/spec/tabs/0', 'section', 'tab', undefined],
        ['section:layout/spec/tabs/0/spec/layout/spec/rows/0', 'section', 'row', 'section:layout/spec/tabs/0'],
        ['panel:a', 'panel', undefined, 'section:layout/spec/tabs/0/spec/layout/spec/rows/0'],
      ]);
    });
  });

  describe('naming', () => {
    it('uses the title when it is unique', () => {
      const structure = structureOf(dashboardOf(gridOf('a'), { a: 'CPU' }), dashboardOf(gridOf('a'), { a: 'CPU' }));

      expect(nodeByLabel(structure, 'Panel "CPU"').id).toBe('panel:a');
    });

    it('names a duplicate title by its position only when a sibling shares it', () => {
      const layout = rows([
        row('API', stackOf('a', 'b')),
        row('DB', gridOf('c')),
        row(
          'Edge',
          grid([
            gridItem('d', { x: 0, y: 0, w: 12, h: 8 }),
            gridItem('e', { x: 0, y: 8, w: 12, h: 8 }),
            gridItem('f', { x: 12, y: 8, w: 12, h: 8 }),
          ])
        ),
      ]);
      const titles = { a: 'Errors', b: 'Latency', c: 'Errors', d: 'Errors', e: 'Errors', f: 'Errors' };
      const structure = structureOf(dashboardOf(layout, titles), dashboardOf(layout, titles));

      expect(outline(structure)).toEqual([
        'Dashboard',
        'Row "API"',
        '  Panel "Errors"',
        '  Panel "Latency"',
        'Row "DB"',
        '  Panel "Errors"',
        'Row "Edge"',
        '  Panel "Errors" at position 1',
        '  Panel "Errors" at position 2',
        '  Panel "Errors" at position 3',
      ]);
    });

    it('names untitled panels by their position among all siblings when another sibling is untitled', () => {
      const layout = tabs([
        tab(
          'Cluster',
          grid([
            gridItem('c', { x: 0, y: 8, w: 12, h: 8 }),
            gridItem('b', { x: 12, y: 0, w: 12, h: 8 }),
            gridItem('a', { x: 0, y: 0, w: 12, h: 8 }),
            gridItem('t', { x: 0, y: 16, w: 12, h: 8 }),
          ])
        ),
        tab('API', gridOf('d')),
      ]);
      const titles = { a: '', b: '', c: ' ', t: 'Titled', d: '' };
      const structure = structureOf(dashboardOf(layout, titles), dashboardOf(layout, titles));

      expect(outline(structure)).toEqual([
        'Dashboard',
        'Tab "Cluster"',
        '  Panel (unnamed) at position 1',
        '  Panel (unnamed) at position 2',
        '  Panel (unnamed) at position 3',
        '  Panel "Titled"',
        'Tab "API"',
        '  Panel (unnamed)',
      ]);
      expect(nodeByLabel(structure, 'Panel (unnamed) at position 1')).toMatchObject({
        id: 'panel:a',
        elementName: 'a',
      });
    });

    it('names root-level panels without a section', () => {
      const titles = { a: '', b: 'Same', c: 'Same' };
      const layout = stackOf('a', 'b', 'c');
      const structure = structureOf(dashboardOf(layout, titles), dashboardOf(layout, titles));

      expect(outline(structure)).toEqual([
        'Dashboard',
        'Panel (unnamed)',
        'Panel "Same" at position 2',
        'Panel "Same" at position 3',
      ]);
    });

    it('labels sections with their full path, and untitled or duplicate sections by position', () => {
      const layout = tabs([
        tab(
          'Cluster',
          rows([
            row('Nodes', gridOf()),
            row(undefined, gridOf()),
            row('', gridOf()),
            row('Dup', gridOf()),
            row('Dup', gridOf()),
          ])
        ),
        tab(undefined, gridOf()),
      ]);
      const structure = structureOf(dashboardOf(layout, {}), dashboardOf(layout, {}));

      expect(outline(structure)).toEqual([
        'Dashboard',
        'Tab "Cluster"',
        '  Tab "Cluster" › Row "Nodes"',
        '  Tab "Cluster" › Row (unnamed) at position 2',
        '  Tab "Cluster" › Row (unnamed) at position 3',
        '  Tab "Cluster" › Row "Dup" at position 4',
        '  Tab "Cluster" › Row "Dup" at position 5',
        'Tab (unnamed)',
      ]);
    });

    it('names panels in deeply nested sections without their section path', () => {
      const layout = tabs([tab('Cluster', rows([row('Nodes', tabs([tab('Detail', stackOf('a', 'b'))]))]))]);
      const structure = structureOf(dashboardOf(layout, { a: '', b: '' }), dashboardOf(layout, { a: '', b: '' }));

      expect(outline(structure).slice(-2)).toEqual([
        '      Panel (unnamed) at position 1',
        '      Panel (unnamed) at position 2',
      ]);
    });

    it('names removed panels by their baseline position', () => {
      const before = dashboardOf(stackOf('a', 'b'), { a: '', b: '' });
      const after = dashboardOf(gridOf('a'), { a: '' });
      const structure = structureOf(before, after);

      expect(outline(structure)).toEqual(['Dashboard', 'Panel (unnamed)', '- Panel (unnamed) at position 2']);
    });

    it('uses the title of library panels', () => {
      const spec = dashboard({
        elements: { lib: libraryPanel('Shared CPU', 'cpu-lib', 'u', 1) },
        layout: gridOf('lib'),
      });

      expect(outline(structureOf(spec, spec))).toEqual(['Dashboard', 'Panel "Shared CPU"']);
    });

    it('shows dashboard titles as is, without HTML escaping', () => {
      const spec = dashboardOf(rows([row('A & <B>', gridOf('a'))]), { a: "it's" });

      expect(outline(structureOf(spec, spec))).toEqual(['Dashboard', 'Row "A & <B>"', `  Panel "it's"`]);
    });
  });

  describe('section matching', () => {
    it('matches sections by title at the same parent; a reordered section is moved', () => {
      const before = dashboardOf(rows([row('API', gridOf('a')), row('DB', gridOf('b'))]), panels);
      const after = dashboardOf(rows([row('DB', gridOf('b')), row('API', gridOf('a'))]), panels);
      const structure = structureOf(before, after);

      // On a tie the section that comes first in the baseline stays put.
      expect(outline(structure).slice(0, 5)).toEqual([
        'Dashboard',
        'Row "DB" moved before Row "API"',
        '  Panel "Memory"',
        'Row "API"',
        '  Panel "CPU"',
      ]);
      expect(structure.changes).toEqual([]);
      expect(nodeByLabel(structure, 'Row "DB"').claims.length).toBeGreaterThan(0);
    });

    it('matches the k-th section with a duplicate title to the k-th one', () => {
      const before = dashboardOf(rows([row('Dup', gridOf('a')), row('Dup', gridOf('b'))]), panels);
      const after = dashboardOf(rows([row('Dup', gridOf('a')), row('Dup', stackOf('b', 'c'))]), panels);
      const structure = structureOf(before, after);

      expect(outline(structure).slice(0, 6)).toEqual([
        'Dashboard',
        'Row "Dup" at position 1',
        '  Panel "CPU"',
        'Row "Dup" at position 2',
        '  Panel "Memory"',
        '  Panel "Disk"',
      ]);
      expect(nodeByLabel(structure, 'Panel "Disk"').status).toBeUndefined();
    });

    it('treats a different title at the same position with mostly the same panels as a title change', () => {
      const before = dashboardOf(rows([row('API', stackOf('a', 'b', 'c'))]), only('a', 'b', 'c'));
      const after = dashboardOf(rows([row('Backend', stackOf('a', 'b', 'd'))]), only('a', 'b', 'd'));
      const structure = structureOf(before, after);

      expect(outline(structure)).toEqual([
        'Dashboard',
        'Row "Backend"',
        '  Panel "CPU"',
        '  Panel "Memory"',
        '  - Panel "Disk"',
        '  + Panel "Network"',
      ]);
      expect(structure.changes).toMatchObject([
        {
          nodeId: 'section:layout/spec/rows/0',
          category: 'properties',
          field: 'title',
          before: 'API',
          after: 'Backend',
        },
      ]);
      expect(structure.changes[0].claims).toEqual(['layout/spec/rows/0/spec/title']);
    });

    it('treats a different title with mostly different panels as a removal and an addition', () => {
      const before = dashboardOf(rows([row('API', stackOf('a', 'b'))]), { a: 'CPU', b: 'Memory' });
      const after = dashboardOf(rows([row('Backend', stackOf('a', 'c'))]), { a: 'CPU', c: 'Disk' });
      const structure = structureOf(before, after);

      // The removed row keeps its baseline position: first.
      expect(outline(structure)).toEqual([
        'Dashboard',
        '- Row "API"',
        '  Panel "Memory"',
        '+ Row "Backend"',
        '  Panel "CPU" moved from Row "API" to Row "Backend", before Panel "Disk"',
        '  + Panel "Disk"',
      ]);
      expect(nodeByLabel(structure, 'Row "API"').removedContents).toEqual(['Panel "Memory"']);
    });

    it('prefers a title match over a position match', () => {
      const before = dashboardOf(rows([row('A', gridOf('a')), row('B', gridOf('b'))]), panels);
      const after = dashboardOf(rows([row('B', gridOf('a')), row('C', gridOf('b'))]), panels);
      const structure = structureOf(before, after);

      // B keeps its identity through its title even though A's panel is in it now.
      expect(nodeByLabel(structure, 'Row "B"').id).toBe('section:layout/spec/rows/0');
      expect(nodeByLabel(structure, 'Panel "CPU"').moveText).toBe('moved from Row "A" to Row "B"');
      expect(nodeByLabel(structure, 'Row "A"').status).toBe('removed');
      expect(nodeByLabel(structure, 'Row "C"').status).toBe('added');
    });

    it('matches empty sections at the same position as a title change', () => {
      const before = dashboardOf(rows([row('Old', gridOf())]), {});
      const after = dashboardOf(rows([row('New', gridOf())]), {});

      expect(changeList(structureOf(before, after))).toEqual(['Row "New": title changed']);
    });

    it('only matches nested sections under matched parents', () => {
      const before = dashboardOf(tabs([tab('T1', rows([row('R', gridOf('a'))]))]), { a: 'CPU' });
      const after = dashboardOf(tabs([tab('T2', rows([row('R', gridOf('b'))]))]), { b: 'Memory' });
      const structure = structureOf(before, after);

      expect(outline(structure)).toEqual([
        'Dashboard',
        '- Tab "T1"',
        '  Tab "T1" › Row "R"',
        '    Panel "CPU"',
        '+ Tab "T2"',
        '  + Tab "T2" › Row "R"',
        '    + Panel "Memory"',
      ]);
      expect(nodeByLabel(structure, 'Tab "T1"').removedContents).toEqual(['Row "R"', 'Panel "CPU"']);
    });
  });

  describe('ordering', () => {
    it('puts removed sections at their baseline position and panels in reading order', () => {
      const before = dashboardOf(
        rows([
          row('A', gridOf('a')),
          row('B', gridOf('b')),
          row('C', grid([gridItem('c', { x: 12, y: 0, w: 12, h: 8 }), gridItem('d', { x: 0, y: 0, w: 12, h: 8 })])),
        ]),
        panels
      );
      const after = dashboardOf(
        rows([
          row('A', gridOf('a')),
          row('C', grid([gridItem('c', { x: 12, y: 0, w: 12, h: 8 }), gridItem('d', { x: 0, y: 0, w: 12, h: 8 })])),
        ]),
        {
          a: 'CPU',
          c: 'Disk',
          d: 'Network',
        }
      );
      const structure = structureOf(before, after);

      expect(outline(structure)).toEqual([
        'Dashboard',
        'Row "A"',
        '  Panel "CPU"',
        '- Row "B"',
        '  Panel "Memory"',
        'Row "C"',
        '  Panel "Network"',
        '  Panel "Disk"',
        '- Panel "Errors"',
      ]);
      expect(nodeByLabel(structure, 'Row "B"').removedContents).toEqual(['Panel "Memory"']);
    });

    it('puts a removed first section first', () => {
      const before = dashboardOf(rows([row('A', gridOf()), row('B', gridOf())]), {});
      const after = dashboardOf(rows([row('B', gridOf())]), {});

      expect(outline(structureOf(before, after))).toEqual(['Dashboard', '- Row "A"', 'Row "B"']);
    });

    it('puts removed panels at their baseline position within their section', () => {
      const before = dashboardOf(stackOf('a', 'b', 'c'), { a: 'A', b: 'B', c: 'C' });
      const after = dashboardOf(
        grid([gridItem('a', { x: 0, y: 0, w: 12, h: 8 }), gridItem('c', { x: 0, y: 16, w: 12, h: 8 })]),
        { a: 'A', c: 'C' }
      );

      expect(outline(structureOf(before, after))).toEqual(['Dashboard', 'Panel "A"', '- Panel "B"', 'Panel "C"']);
    });
  });

  describe('statuses', () => {
    it('marks added and removed panels, claiming the element and its layout item', () => {
      const before = dashboardOf(stackOf('a', 'b'), { a: 'CPU', b: 'Memory' });
      const after = dashboardOf(stackOf('a', 'c'), { a: 'CPU', c: 'Disk' });
      const structure = structureOf(before, after);

      expect(nodeByLabel(structure, 'Panel "Disk"')).toMatchObject({ status: 'added' });
      expect(nodeByLabel(structure, 'Panel "Memory"')).toMatchObject({ status: 'removed' });
      expect(
        [...nodeByLabel(structure, 'Panel "Disk"').claims, ...nodeByLabel(structure, 'Panel "Memory"').claims].sort()
      ).toEqual(['elements/b', 'elements/c', 'layout/spec/items/1/spec/element/name']);
      expect(structure.changes).toEqual([]);
    });

    it('marks a removed section and lists the panels and nested sections removed with it', () => {
      const before = dashboardOf(
        rows([row('Keep', gridOf('a')), row('API', tabs([tab('Inner', stackOf('b', 'c'))]))]),
        panels
      );
      const after = dashboardOf(rows([row('Keep', stackOf('a', 'c'))]), { a: 'CPU', c: 'Disk' });
      const structure = structureOf(before, after);

      const removed = nodeByLabel(structure, 'Row "API"');
      expect(removed).toMatchObject({ status: 'removed' });
      // Disk was moved out before the row was removed, so it isn't removed with it.
      expect(removed.removedContents).toEqual(['Tab "Inner"', 'Panel "Memory"']);
      expect(removed.claims.sort()).toEqual(['elements/b', 'layout/spec/rows/1']);
      expect(nodeByLabel(structure, 'Row "API" › Tab "Inner"').status).toBeUndefined();
      expect(nodeByLabel(structure, 'Panel "Memory"').status).toBeUndefined();
      // A removed source is named by its baseline full path.
      expect(nodeByLabel(structure, 'Panel "Disk"').moveText).toBe(
        'moved from Row "API" › Tab "Inner" to Row "Keep", after Panel "CPU"'
      );
    });

    it('marks an added section and the panels added with it', () => {
      const before = dashboardOf(rows([row('Keep', gridOf('a'))]), { a: 'CPU' });
      const after = dashboardOf(rows([row('Keep', gridOf('a')), row('New', gridOf('b'))]), {
        a: 'CPU',
        b: 'Memory',
      });
      const structure = structureOf(before, after);

      expect(outline(structure)).toEqual([
        'Dashboard',
        'Row "Keep"',
        '  Panel "CPU"',
        '+ Row "New"',
        '  + Panel "Memory"',
      ]);
      expect(nodeByLabel(structure, 'Row "New"').claims).toEqual(['layout/spec/rows/1']);
      expect(nodeByLabel(structure, 'Panel "Memory"').claims).toEqual(['elements/b']);
    });

    it('marks a panel moved between sections that exist on both sides', () => {
      const before = dashboardOf(rows([row('API', stackOf('a', 'b')), row('DB', gridOf('c'))]), panels);
      const after = dashboardOf(rows([row('API', gridOf('a')), row('DB', stackOf('c', 'b'))]), panels);
      const structure = structureOf(before, after);

      expect(nodeByLabel(structure, 'Panel "Memory"')).toMatchObject({
        status: 'moved',
        moveText: 'moved from Row "API" to Row "DB", after Panel "Disk"',
        parentId: 'section:layout/spec/rows/1',
      });
      expect(nodeByLabel(structure, 'Panel "Memory"').claims.sort()).toEqual([
        'layout/spec/rows/0/spec/layout/spec/items/1',
        'layout/spec/rows/1/spec/layout/spec/items/1',
      ]);
      expect(structure.changes).toEqual([]);
    });

    it('names the source section of a move by its current title when it was renamed', () => {
      const before = dashboardOf(rows([row('API', stackOf('a', 'b', 'c')), row('DB', gridOf())]), panels);
      const after = dashboardOf(rows([row('Backend', stackOf('a', 'b')), row('DB', gridOf('c'))]), panels);

      expect(nodeByLabel(structureOf(before, after), 'Panel "Disk"').moveText).toBe(
        'moved from Row "Backend" to Row "DB"'
      );
    });
  });

  describe('ambiguous names', () => {
    it('drops the position from a moved node header and ends the move text with its new position', () => {
      const titles = { a: 'New panel', b: 'New panel', c: 'Latency' };
      const before = dashboardOf(autoGrid([autoGridItem('a'), autoGridItem('b'), autoGridItem('c')]), titles);
      const after = dashboardOf(autoGrid([autoGridItem('b'), autoGridItem('a'), autoGridItem('c')]), titles);

      expect(outline(structureOf(before, after))).toEqual([
        'Dashboard',
        'Panel "New panel" moved before Panel "New panel", at position 1',
        'Panel "New panel" at position 2',
        'Panel "Latency"',
      ]);
    });

    it('does the same for a moved section with a shared title', () => {
      const before = dashboardOf(rows([row('Dup', gridOf('a')), row('Dup', gridOf('b'))]), panels);
      const after = dashboardOf(rows([row('Dup', gridOf('b')), row('Dup', gridOf('a'))]), panels);
      const structure = structureOf(before, after);

      // Title matching pairs the k-th 'Dup' with the k-th, so only their panels moved.
      expect(
        plainNodes(structure)
          .filter((n) => n.status)
          .map((n) => `${n.label} ${n.moveText}${n.movePosition ? `, at position ${n.movePosition}` : ''}`)
      ).toEqual([
        'Panel "Memory" moved from Row "Dup" at position 2 to Row "Dup" at position 1',
        'Panel "CPU" moved from Row "Dup" at position 1 to Row "Dup" at position 2',
      ]);

      const tabbed = (order: string[]) =>
        dashboardOf(tabs([tab('Cluster', rows(order.map((title) => row(title, gridOf()))))]), {});
      const moved = structureOf(tabbed(['X', 'Dup', 'Dup']), tabbed(['Dup', 'X', 'Dup']));
      expect(
        plainNodes(moved)
          .filter((n) => n.status)
          .map((n) => `${n.label} ${n.moveText}${n.movePosition ? `, at position ${n.movePosition}` : ''}`)
      ).toEqual([
        // On a tie the earlier baseline section (X) stays put.
        'Tab "Cluster" › Row "Dup" moved before Row "X", at position 1',
      ]);
    });

    it('gives panels an owner label with their section when the title is not unique in the dashboard', () => {
      const titles = { a: 'Errors', b: 'Errors', c: 'Errors', d: 'Unique', e: '' };
      const layout = tabs([tab('API', stackOf('a', 'd')), tab('DB', stackOf('b', 'c', 'e'))]);
      const structure = structureOf(dashboardOf(layout, titles), dashboardOf(layout, titles));
      const owner = (name: string) => plainNodes(structure).find((n) => n.elementName === name)?.ownerLabel;

      expect(['a', 'b', 'c', 'd', 'e'].map(owner)).toEqual([
        'Panel "Errors" in Tab "API"',
        'Panel "Errors" at position 1 in Tab "DB"',
        'Panel "Errors" at position 2 in Tab "DB"',
        'Panel "Unique"',
        'Panel (unnamed)',
      ]);

      const root = structureOf(dashboardOf(stackOf('a', 'b'), titles), dashboardOf(stackOf('a', 'b'), titles));
      expect(
        plainNodes(root)
          .filter((n) => n.kind === 'panel')
          .map((n) => n.ownerLabel)
      ).toEqual(expect.arrayContaining(['Panel "Errors" at position 1', 'Panel "Errors" at position 2']));
    });

    it('names nested sections removed with a section relative to it, and panels by their baseline name', () => {
      const before = dashboardOf(
        rows([row('Keep', gridOf()), row('API', tabs([tab('Inner', rows([row('Deep', stackOf('a', 'b'))]))]))]),
        { a: 'New panel', b: 'New panel' }
      );
      const after = dashboardOf(rows([row('Keep', gridOf())]), {});

      expect(nodeByLabel(structureOf(before, after), 'Row "API"').removedContents).toEqual([
        'Tab "Inner"',
        'Tab "Inner" › Row "Deep"',
        'Panel "New panel" at position 1',
        'Panel "New panel" at position 2',
      ]);
    });
  });

  describe('restructures', () => {
    it('reports rows to tabs as one layout change on the dashboard, matching sections by title', () => {
      const before = dashboardOf(rows([row('API', gridOf('a')), row('DB', gridOf('b'))]), panels);
      const after = dashboardOf(tabs([tab('DB', gridOf('b')), tab('API', gridOf('a'))]), panels);
      const structure = structureOf(before, after);

      expect(changeList(structure)).toEqual(['Dashboard: Layout: changed from rows to tabs']);
      expect(structure.changes[0]).toMatchObject({
        nodeId: 'dashboard',
        category: 'layout',
        field: 'layoutType',
        before: 'RowsLayout',
        after: 'TabsLayout',
      });
      expect(structure.changes[0].claims.sort()).toEqual(['layout/kind', 'layout/spec/rows', 'layout/spec/tabs']);
      // The reorder still reads as a move; its diffs are part of the restructure.
      expect(plainNodes(structure).filter((n) => n.status)).toMatchObject([
        { label: 'Tab "DB"', status: 'moved', moveText: 'moved before Tab "API"', claims: [] },
      ]);
    });

    it('still reports a move between two sections that survive a rows to tabs change', () => {
      const before = dashboardOf(rows([row('API', stackOf('a', 'b')), row('DB', gridOf())]), panels);
      const after = dashboardOf(tabs([tab('API', gridOf('a')), tab('DB', gridOf('b'))]), panels);

      expect(nodeByLabel(structureOf(before, after), 'Panel "Memory"').moveText).toBe(
        'moved from Tab "API" to Tab "DB"'
      );
    });

    it('keeps the identity of rows wrapped into a new tab', () => {
      const before = dashboardOf(rows([row('API', gridOf('a')), row('DB', gridOf('b'))]), panels);
      const after = dashboardOf(
        tabs([tab('New tab', rows([row('API', gridOf('a')), row('DB', gridOf('b'))]))]),
        panels
      );
      const structure = structureOf(before, after);

      expect(changeList(structure)).toEqual(['Dashboard: Layout: changed from rows to tabs']);
      expect(
        plainNodes(structure)
          .filter((n) => n.status)
          .map((n) => n.label)
      ).toEqual(['Tab "New tab"']);
    });

    it('keeps the identity of rows unwrapped from a removed tab', () => {
      const before = dashboardOf(
        tabs([tab('Wrapper', rows([row('API', gridOf('a')), row('DB', gridOf('b'))]))]),
        panels
      );
      const after = dashboardOf(rows([row('API', gridOf('a')), row('DB', gridOf('b'))]), panels);
      const structure = structureOf(before, after);

      expect(changeList(structure)).toEqual(['Dashboard: Layout: changed from tabs to rows']);
      expect(plainNodes(structure).filter((n) => n.status)).toMatchObject([
        { label: 'Tab "Wrapper"', status: 'removed', removedContents: [] },
      ]);
    });

    it('marks a panel added inside the new rows of a restructure as added, claiming only its element', () => {
      const before = dashboardOf(gridOf('a'), only('a'));
      const after = dashboardOf(rows([row('Overview', stackOf('a', 'b'))]), only('a', 'b'));
      const structure = structureOf(before, after);

      expect(nodeByLabel(structure, 'Panel "Memory"')).toMatchObject({ status: 'added', claims: ['elements/b'] });
      expect(nodeByLabel(structure, 'Panel "CPU"').status).toBeUndefined();
    });

    it('reports grid to rows without moving every panel; the new rows are added', () => {
      const before = dashboardOf(stackOf('a', 'b'), { a: 'CPU', b: 'Memory' });
      const after = dashboardOf(rows([row('Overview', stackOf('a', 'b'))]), { a: 'CPU', b: 'Memory' });
      const structure = structureOf(before, after);

      expect(changeList(structure)).toEqual(['Dashboard: Layout: changed from custom grid to rows']);
      expect(outline(structure)).toEqual(['Dashboard', '+ Row "Overview"', '  Panel "CPU"', '  Panel "Memory"']);
      expect(nodeByLabel(structure, 'Row "Overview"').claims).toEqual([]);
    });

    it('reports rows to grid without moving every panel; the old rows are removed', () => {
      const before = dashboardOf(rows([row('A', gridOf('a')), row('B', stackOf('b', 'c'))]), only('a', 'b', 'c'));
      const after = dashboardOf(stackOf('a', 'b'), only('a', 'b'));
      const structure = structureOf(before, after);

      expect(changeList(structure)).toEqual(['Dashboard: Layout: changed from rows to custom grid']);
      expect(outline(structure)).toEqual([
        'Dashboard',
        '- Row "A"',
        '- Row "B"',
        '  Panel "Disk"',
        'Panel "CPU"',
        'Panel "Memory"',
      ]);
      expect(nodeByLabel(structure, 'Row "B"')).toMatchObject({
        removedContents: ['Panel "Disk"'],
        claims: ['elements/c'],
      });
    });

    it('reports a nested layout change on the owning section', () => {
      const before = dashboardOf(tabs([tab('Cluster', stackOf('a', 'b'))]), panels);
      const after = dashboardOf(tabs([tab('Cluster', autoGrid([autoGridItem('a'), autoGridItem('b')]))]), panels);
      const structure = structureOf(before, after);

      expect(changeList(structure)).toEqual(['Tab "Cluster": Layout: changed from custom grid to auto grid']);
      expect(structure.changes[0]).toMatchObject({ nodeId: 'section:layout/spec/tabs/0', category: 'layout' });
    });

    it('reports a nested section move and auto grid settings on the owning sections', () => {
      const before = dashboardOf(
        tabs([
          tab('Cluster', rows([row('A', gridOf()), row('B', autoGrid([autoGridItem('a')], { maxColumnCount: 3 }))])),
        ]),
        panels
      );
      const after = dashboardOf(
        tabs([
          tab('Cluster', rows([row('B', autoGrid([autoGridItem('a')], { maxColumnCount: 2 })), row('A', gridOf())])),
        ]),
        panels
      );
      const structure = structureOf(before, after);

      expect(nodeByLabel(structure, 'Tab "Cluster" › Row "B"')).toMatchObject({
        status: 'moved',
        moveText: 'moved before Row "A"',
      });
      expect(
        structure.changes.map(({ nodeId, category, field, subField }) => ({ nodeId, category, field, subField }))
      ).toEqual([
        {
          nodeId: 'section:layout/spec/tabs/0/spec/layout/spec/rows/0',
          category: 'layout',
          field: 'layoutSettings',
          subField: 'maxColumnCount',
        },
      ]);
    });
  });

  describe('index-shift noise', () => {
    it('claims shifted grid items with the removal that caused them, without changing untouched panels', () => {
      const before = dashboardOf(stackOf('a', 'b', 'c', 'd'), only('a', 'b', 'c', 'd'));
      const after = dashboardOf(stackOf('b', 'c', 'd'), only('b', 'c', 'd'));
      const structure = structureOf(before, after);

      expect(structure.changes).toEqual([]);
      expect(nodeByLabel(structure, 'Panel "CPU"').claims).toContain('layout/spec/items/3');
      expect(
        plainNodes(structure)
          .filter((n) => n.claims.length)
          .map((n) => n.label)
      ).toEqual(['Panel "CPU"']);
    });

    it('does not report panels pushed down by an inserted panel', () => {
      const before = dashboardOf(stackOf('a', 'b'), only('a', 'b'));
      const after = dashboardOf(stackOf('c', 'a', 'b'), only('a', 'b', 'c'));
      const structure = structureOf(before, after);

      expect(structure.changes).toEqual([]);
      expect(
        plainNodes(structure)
          .filter((n) => n.claims.length)
          .map((n) => n.label)
      ).toEqual(['Panel "Disk"']);
    });

    it('claims shifted rows with the removed row', () => {
      const before = dashboardOf(
        rows([row('A', gridOf('a')), row('B', gridOf('b')), row('C', gridOf('c'))]),
        only('a', 'b', 'c')
      );
      const after = dashboardOf(rows([row('B', gridOf('b')), row('C', gridOf('c'))]), only('b', 'c'));
      const structure = structureOf(before, after);

      expect(structure.changes).toEqual([]);
      expect(
        plainNodes(structure)
          .filter((n) => n.claims.length)
          .map((n) => n.label)
      ).toEqual(['Row "A"']);
    });

    it('claims shifted auto grid items with the inserted panel', () => {
      const before = dashboardOf(
        autoGrid([autoGridItem('a'), autoGridItem('b'), autoGridItem('c')]),
        only('a', 'b', 'c')
      );
      const after = dashboardOf(
        autoGrid([autoGridItem('d'), autoGridItem('a'), autoGridItem('b'), autoGridItem('c')]),
        only('a', 'b', 'c', 'd')
      );
      const structure = structureOf(before, after);

      expect(structure.changes).toEqual([]);
      expect(nodeByLabel(structure, 'Panel "Network"').claims.sort()).toEqual([
        'elements/d',
        'layout/spec/items/0/spec/element/name',
        'layout/spec/items/1/spec/element/name',
        'layout/spec/items/2/spec/element/name',
        'layout/spec/items/3',
      ]);
    });
  });

  describe('layout changes', () => {
    it('reports section properties, repeat, show/hide and controls', () => {
      const variable = { kind: 'CustomVariable', spec: { name: 'env' } };
      const condition = {
        kind: 'ConditionalRenderingGroup',
        spec: { visibility: 'show', condition: 'and', items: [] },
      };
      // Without the serializer's `collapse: false`, so every setting here is added.
      const before = dashboardOf(rows([row('API', gridOf('a'), { collapse: undefined })]), panels);
      const after = dashboardOf(
        rows([
          row('API', gridOf('a'), {
            hideHeader: true,
            collapse: true,
            fillScreen: true,
            repeat: { mode: 'variable', value: 'env' },
            conditionalRendering: condition as never,
            variables: [variable as never],
            annotations: [],
          }),
        ]),
        panels
      );
      const structure = structureOf(before, after);

      expect(structure.changes.map((c) => [c.field, c.category, c.kind, c.claims])).toEqual([
        ['hideHeader', 'properties', 'added', ['layout/spec/rows/0/spec/hideHeader']],
        ['fillScreen', 'properties', 'added', ['layout/spec/rows/0/spec/fillScreen']],
        ['collapse', 'properties', 'added', ['layout/spec/rows/0/spec/collapse']],
        ['repeat', 'repeat', 'added', ['layout/spec/rows/0/spec/repeat']],
        ['conditionalRendering', 'showHide', 'added', ['layout/spec/rows/0/spec/conditionalRendering']],
        ['variables', 'controls', 'added', ['layout/spec/rows/0/spec/variables']],
        ['annotations', 'controls', 'added', ['layout/spec/rows/0/spec/annotations']],
      ]);
      expect(structure.changes.find((c) => c.field === 'variables')).toMatchObject({
        before: undefined,
        after: [variable],
      });
    });

    it('claims every diff inside a section list field with that one change', () => {
      const v = (name: string) => ({ kind: 'CustomVariable', spec: { name, query: name } }) as never;
      const before = dashboardOf(tabs([tab('T', gridOf(), { variables: [v('a'), v('b')] })]), {});
      const after = dashboardOf(tabs([tab('T', gridOf(), { variables: [v('b')] })]), {});
      const structure = structureOf(before, after);

      expect(structure.changes).toMatchObject([
        { field: 'variables', kind: 'changed', before: [v('a'), v('b')], after: [v('b')] },
      ]);
      expect(structure.changes[0].claims.length).toBe(layoutDiffsOf(before, after).length);
    });

    it('reports panel position and size from its grid item', () => {
      const before = dashboardOf(gridOf('a', 'b'), panels);
      const after = dashboardOf(
        grid([gridItem('a', { x: 0, y: 0, w: 24, h: 8 }), gridItem('b', { x: 0, y: 8, w: 12, h: 8 })]),
        panels
      );
      const structure = structureOf(before, after);

      expect(structure.changes).toMatchObject([
        {
          nodeId: 'panel:a',
          field: 'size',
          category: 'layout',
          before: { width: 12, height: 8 },
          after: { width: 24, height: 8 },
        },
        { nodeId: 'panel:b', field: 'position', category: 'layout', before: { x: 12, y: 0 }, after: { x: 0, y: 8 } },
      ]);
    });

    it('does not report panels the grid pushed down when another panel grew', () => {
      const before = dashboardOf(stackOf('a', 'b'), panels);
      const after = dashboardOf(
        grid([gridItem('a', { x: 0, y: 0, w: 12, h: 16 }), gridItem('b', { x: 0, y: 16, w: 12, h: 8 })]),
        panels
      );
      const structure = structureOf(before, after);

      expect(changeList(structure)).toEqual(['Panel "CPU": size changed']);
      expect(structure.changes[0].claims.sort()).toEqual([
        'layout/spec/items/0/spec/height',
        'layout/spec/items/1/spec/y',
      ]);
    });

    it('reports a panel dragged past others as moved, not as a position change of every panel', () => {
      const before = dashboardOf(stackOf('a', 'b', 'c'), panels);
      const after = dashboardOf(stackOf('b', 'c', 'a'), panels);
      const structure = structureOf(before, after);

      expect(outline(structure).slice(0, 4)).toEqual([
        'Dashboard',
        'Panel "Memory"',
        'Panel "Disk"',
        'Panel "CPU" moved after Panel "Disk"',
      ]);
      expect(structure.changes).toEqual([]);
      expect(nodeByLabel(structure, 'Panel "CPU"').claims.length).toBeGreaterThan(0);
    });

    it('reports a position change when the reading order stays the same', () => {
      const before = dashboardOf(stackOf('a', 'b'), only('a', 'b'));
      const after = dashboardOf(
        grid([gridItem('a', { x: 0, y: 0, w: 12, h: 8 }), gridItem('b', { x: 12, y: 8, w: 12, h: 8 })]),
        only('a', 'b')
      );
      const structure = structureOf(before, after);

      expect(changeList(structure)).toEqual(['Panel "Memory": position changed']);
      expect(plainNodes(structure).filter((n) => n.status)).toEqual([]);
    });

    it('keeps the panel whose coordinates did not change in place on a tie', () => {
      const before = dashboardOf(stackOf('a', 'b'), only('a', 'b'));
      const after = dashboardOf(
        grid([gridItem('b', { x: 0, y: 8, w: 12, h: 8 }), gridItem('a', { x: 0, y: 16, w: 12, h: 8 })]),
        only('a', 'b')
      );
      const structure = structureOf(before, after);

      expect(outline(structure)).toEqual(['Dashboard', 'Panel "Memory"', 'Panel "CPU" moved after Panel "Memory"']);
    });

    it('keeps the earlier baseline item in place on a tie, and words a move to the front by the next item', () => {
      const before = dashboardOf(
        autoGrid([autoGridItem('a'), autoGridItem('b'), autoGridItem('c')]),
        only('a', 'b', 'c')
      );
      const after = dashboardOf(
        autoGrid([autoGridItem('c'), autoGridItem('a'), autoGridItem('b')]),
        only('a', 'b', 'c')
      );
      const structure = structureOf(before, after);

      expect(outline(structure)).toEqual([
        'Dashboard',
        'Panel "Disk" moved before Panel "CPU"',
        'Panel "CPU"',
        'Panel "Memory"',
      ]);
      expect(structure.changes).toEqual([]);

      const swapped = structureOf(
        dashboardOf(autoGrid([autoGridItem('a'), autoGridItem('b')]), only('a', 'b')),
        dashboardOf(autoGrid([autoGridItem('b'), autoGridItem('a')]), only('a', 'b'))
      );
      expect(outline(swapped)).toEqual(['Dashboard', 'Panel "Memory" moved before Panel "CPU"', 'Panel "CPU"']);
    });

    it('names the top level of the dashboard as an end of a move, and leaves statusText to describe/', () => {
      const before = dashboardOf(rows([row('API', gridOf('a')), row('DB', gridOf('b'))]), only('a', 'b'));
      const after = dashboardOf(rows([row('API', gridOf()), row('DB', stackOf('b', 'a'))]), only('a', 'b'));
      const node = nodeByLabel(structureOf(before, after), 'Panel "CPU"');

      expect(node).toMatchObject({
        status: 'moved',
        moveText: 'moved from Row "API" to Row "DB", after Panel "Memory"',
      });
      expect(node.movePosition).toBeUndefined();
    });

    it('words a move into another section by its neighbour there, or alone', () => {
      const before = dashboardOf(
        rows([row('API', stackOf('a', 'b')), row('DB', gridOf('c')), row('Empty', gridOf())]),
        panels
      );
      const after = dashboardOf(
        rows([row('API', gridOf()), row('DB', stackOf('a', 'c')), row('Empty', gridOf('b'))]),
        panels
      );
      const structure = structureOf(before, after);

      expect(nodeByLabel(structure, 'Panel "CPU"').moveText).toBe(
        'moved from Row "API" to Row "DB", before Panel "Disk"'
      );
      expect(nodeByLabel(structure, 'Panel "Memory"').moveText).toBe('moved from Row "API" to Row "Empty"');
    });

    it('reports auto grid item repeat, show/hide rules and fit content', () => {
      const before = dashboardOf(autoGrid([autoGridItem('a')]), panels);
      const condition = {
        kind: 'ConditionalRenderingGroup',
        spec: { visibility: 'hide', condition: 'and', items: [] },
      };
      const after = dashboardOf(
        autoGrid([
          autoGridItem('a', {
            repeat: { mode: 'variable', value: 'env' },
            fitContent: true,
            conditionalRendering: condition as never,
          }),
        ]),
        panels
      );
      const structure = structureOf(before, after);

      expect(structure.changes.map((c) => [c.field, c.category, c.kind])).toEqual([
        ['repeat', 'layout', 'added'],
        ['conditionalRendering', 'showHide', 'added'],
        ['fitContent', 'layout', 'added'],
      ]);
    });

    it('reports each auto grid setting as its own layout settings change, keyed by the setting', () => {
      const before = dashboardOf(autoGrid([autoGridItem('a')], { maxColumnCount: 3 }), panels);
      const after = dashboardOf(
        autoGrid([autoGridItem('a')], { maxColumnCount: 4, columnWidthMode: 'wide', fillScreen: true }),
        panels
      );
      const structure = structureOf(before, after);

      expect(
        structure.changes.map(({ nodeId, category, field, subField, kind, before, after, claims }) => ({
          nodeId,
          category,
          field,
          subField,
          kind,
          before,
          after,
          claims,
        }))
      ).toEqual([
        {
          nodeId: 'dashboard',
          category: 'layout',
          field: 'layoutSettings',
          kind: 'changed',
          subField: 'maxColumnCount',
          before: 3,
          after: 4,
          claims: ['layout/spec/maxColumnCount'],
        },
        {
          nodeId: 'dashboard',
          category: 'layout',
          field: 'layoutSettings',
          kind: 'changed',
          subField: 'columnWidthMode',
          before: 'standard',
          after: 'wide',
          claims: ['layout/spec/columnWidthMode'],
        },
        {
          nodeId: 'dashboard',
          category: 'layout',
          field: 'layoutSettings',
          kind: 'added',
          subField: 'fillScreen',
          before: undefined,
          after: true,
          claims: ['layout/spec/fillScreen'],
        },
      ]);
    });
  });

  describe('untrusted keys and kinds', () => {
    it.each(['constructor', 'toString', '__proto__', 'hasOwnProperty'])(
      'treats an element named %s like any other element',
      (name) => {
        const before = dashboardOf(gridOf('a'), only('a'));
        const after = dashboardOf(stackOf('a', name), { ...only('a') });
        after.elements = { ...after.elements };
        Object.defineProperty(after.elements, name, {
          value: panel('Odd'),
          enumerable: true,
          writable: true,
          configurable: true,
        });
        const structure = structureOf(before, after);

        expect(plainNodes(structure).find((n) => n.elementName === name)).toMatchObject({
          label: 'Panel "Odd"',
          status: 'added',
        });
        expect(structure.changes).toEqual([]);

        const removed = structureOf(after, before);
        expect(plainNodes(removed).find((n) => n.elementName === name)).toMatchObject({ status: 'removed' });
        expect(removed.changes).toEqual([]);
      }
    );

    it('names an unknown layout kind from the kind itself and claims its diffs', () => {
      const before = dashboardOf(gridOf('a'), only('a'));
      const after = dashboardOf({ kind: 'MasonryLayout', spec: { columns: 3 } } as unknown as Layout, only('a'));
      const structure = structureOf(before, after);

      expect(changeList(structure)).toEqual(['Dashboard: Layout: changed from custom grid to Masonry layout']);
    });

    it('walks an unknown layout kind on both sides without throwing, claiming its diffs', () => {
      const unknown = (columns: number) =>
        ({ kind: 'MasonryLayout', spec: { columns, items: [{ odd: true }] } }) as unknown as Layout;
      const structure = structureOf(dashboardOf(unknown(3), {}), dashboardOf(unknown(4), {}));

      expect(structure.changes).toMatchObject([
        { nodeId: 'dashboard', field: 'layoutSettings', text: 'Layout: changed', claims: ['layout/spec/columns'] },
      ]);
    });
  });

  describe('claims', () => {
    const cases: Array<[string, DashboardV2Spec, DashboardV2Spec]> = [
      ['no change', dashboardOf(gridOf('a'), panels), dashboardOf(gridOf('a'), panels)],
      [
        'nested everything',
        dashboardOf(
          tabs([
            tab('T1', rows([row('R1', stackOf('a', 'b')), row('R2', autoGrid([autoGridItem('c')]))])),
            tab('T2', gridOf('d')),
          ]),
          panels
        ),
        dashboardOf(
          tabs([
            tab('T2', grid([gridItem('d', { x: 0, y: 8, w: 12, h: 8 }), gridItem('e', { x: 0, y: 0, w: 12, h: 8 })])),
            tab(
              'T1 renamed',
              rows([
                row('R2', autoGrid([autoGridItem('c'), autoGridItem('b')], { fillScreen: true })),
                row('R3', gridOf('f')),
              ])
            ),
          ]),
          { ...panels, f: 'New' }
        ),
      ],
      [
        'root kind and nested changes at once',
        dashboardOf(rows([row('A', tabs([tab('X', gridOf('a'))]))]), panels),
        dashboardOf(autoGrid([autoGridItem('a'), autoGridItem('b')]), panels),
      ],
      ['new dashboard', dashboardOf(gridOf(), {}), dashboardOf(rows([row('A', gridOf('a'))]), { a: 'CPU' })],
    ];

    it.each(cases)('claims every diff exactly once: %s', (_, before, after) => {
      const diffs = layoutDiffsOf(before, after);
      expect(claimProblems(buildStructure(before, after, diffs), diffs)).toBe('');
    });
  });
});
