import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';

import { buildStructure } from './buildStructure';
import {
  autoGrid,
  changeList,
  claimProblems,
  dashboard,
  grid,
  layoutDiffsOf,
  moveStatusText,
  outline,
  row,
  rows,
  structureOf,
  tab,
  tabs,
} from './testUtils';

const panels = { a: 'CPU', b: 'Memory', c: 'Disk', d: 'Network', e: 'Errors' };

/** The test panels with the given element names. */
function only(...names: Array<keyof typeof panels>): Record<string, string> {
  return Object.fromEntries(names.map((name) => [name, panels[name]]));
}

function nodeByLabel(structure: ReturnType<typeof structureOf>, label: string) {
  const node = structure.nodes.find((n) => n.label === label);
  if (!node) {
    throw new Error(`No node labelled ${label}: ${outline(structure).join(' | ')}`);
  }
  return node;
}

describe('buildStructure', () => {
  describe('nodes', () => {
    it('lists the dashboard, then every section and panel of either side', () => {
      const layout = rows(row('API', grid(['a', 0, 0], ['b', 12, 0])), row('DB', grid(['c', 0, 0])));
      const structure = structureOf(dashboard(layout, panels), dashboard(layout, panels));

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
      expect(structure.panelNodeId('a')).toBe(nodeByLabel(structure, 'Panel "CPU"').id);
      expect(structure.panelNodeId('nope')).toBeUndefined();
    });

    it('gives stable ids, with parents for nesting', () => {
      const layout = tabs(tab('Cluster', rows(row('Nodes', grid(['a', 0, 0])))));
      const structure = structureOf(dashboard(layout, { a: 'CPU' }), dashboard(layout, { a: 'CPU' }));

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
      const structure = structureOf(
        dashboard(grid(['a', 0, 0]), { a: 'CPU' }),
        dashboard(grid(['a', 0, 0]), { a: 'CPU' })
      );

      expect(nodeByLabel(structure, 'Panel "CPU"').id).toBe('panel:a');
    });

    it('names a duplicate title by its position only when a sibling shares it', () => {
      const layout = rows(
        row('API', grid(['a', 0, 0], ['b', 0, 8])),
        row('DB', grid(['c', 0, 0])),
        row('Edge', grid(['d', 0, 0], ['e', 0, 8], ['f', 12, 8]))
      );
      const titles = { a: 'Errors', b: 'Latency', c: 'Errors', d: 'Errors', e: 'Errors', f: 'Errors' };
      const structure = structureOf(dashboard(layout, titles), dashboard(layout, titles));

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
      const layout = tabs(
        tab('Cluster', grid(['c', 0, 8], ['b', 12, 0], ['a', 0, 0], ['t', 0, 16])),
        tab('API', grid(['d', 0, 0]))
      );
      const titles = { a: '', b: '', c: ' ', t: 'Titled', d: '' };
      const structure = structureOf(dashboard(layout, titles), dashboard(layout, titles));

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
      expect(structure.panelNodeId('a')).toBe('panel:a');
      expect(nodeByLabel(structure, 'Panel (unnamed) at position 1').elementName).toBe('a');
    });

    it('names root-level panels without a section', () => {
      const titles = { a: '', b: 'Same', c: 'Same' };
      const layout = grid(['a', 0, 0], ['b', 0, 8], ['c', 0, 16]);
      const structure = structureOf(dashboard(layout, titles), dashboard(layout, titles));

      expect(outline(structure)).toEqual([
        'Dashboard',
        'Panel (unnamed)',
        'Panel "Same" at position 2',
        'Panel "Same" at position 3',
      ]);
    });

    it('labels sections with their full path, and untitled or duplicate sections by position', () => {
      const layout = tabs(
        tab(
          'Cluster',
          rows(row('Nodes', grid()), row(undefined, grid()), row('', grid()), row('Dup', grid()), row('Dup', grid()))
        ),
        tab(undefined, grid())
      );
      const structure = structureOf(dashboard(layout, {}), dashboard(layout, {}));

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
      const layout = tabs(tab('Cluster', rows(row('Nodes', tabs(tab('Detail', grid(['a', 0, 0], ['b', 0, 8])))))));
      const structure = structureOf(dashboard(layout, { a: '', b: '' }), dashboard(layout, { a: '', b: '' }));

      expect(outline(structure).slice(-2)).toEqual([
        '      Panel (unnamed) at position 1',
        '      Panel (unnamed) at position 2',
      ]);
    });

    it('names removed panels by their baseline position', () => {
      const before = dashboard(grid(['a', 0, 0], ['b', 0, 8]), { a: '', b: '' });
      const after = dashboard(grid(['a', 0, 0]), { a: '' });
      const structure = structureOf(before, after);

      expect(outline(structure)).toEqual(['Dashboard', 'Panel (unnamed)', '- Panel (unnamed) at position 2']);
    });

    it('uses the title of library panels', () => {
      const spec = dashboard(grid(['lib', 0, 0]), {});
      spec.elements.lib = {
        kind: 'LibraryPanel',
        spec: { id: 1, title: 'Shared CPU', libraryPanel: { uid: 'u', name: 'cpu-lib' } },
      };

      expect(outline(structureOf(spec, spec))).toEqual(['Dashboard', 'Panel "Shared CPU"']);
    });

    it('shows dashboard titles as is, without HTML escaping', () => {
      const spec = dashboard(rows(row('A & <B>', grid(['a', 0, 0]))), { a: "it's" });

      expect(outline(structureOf(spec, spec))).toEqual(['Dashboard', 'Row "A & <B>"', `  Panel "it's"`]);
    });
  });

  describe('section matching', () => {
    it('matches sections by title at the same parent; a reordered section is moved', () => {
      const before = dashboard(rows(row('API', grid(['a', 0, 0])), row('DB', grid(['b', 0, 0]))), panels);
      const after = dashboard(rows(row('DB', grid(['b', 0, 0])), row('API', grid(['a', 0, 0]))), panels);
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
      const before = dashboard(rows(row('Dup', grid(['a', 0, 0])), row('Dup', grid(['b', 0, 0]))), panels);
      const after = dashboard(rows(row('Dup', grid(['a', 0, 0])), row('Dup', grid(['b', 0, 0], ['c', 0, 8]))), panels);
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
      const before = dashboard(rows(row('API', grid(['a', 0, 0], ['b', 0, 8], ['c', 0, 16]))), only('a', 'b', 'c'));
      const after = dashboard(rows(row('Backend', grid(['a', 0, 0], ['b', 0, 8], ['d', 0, 16]))), only('a', 'b', 'd'));
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
      const before = dashboard(rows(row('API', grid(['a', 0, 0], ['b', 0, 8]))), { a: 'CPU', b: 'Memory' });
      const after = dashboard(rows(row('Backend', grid(['a', 0, 0], ['c', 0, 8]))), { a: 'CPU', c: 'Disk' });
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
      const before = dashboard(rows(row('A', grid(['a', 0, 0])), row('B', grid(['b', 0, 0]))), panels);
      const after = dashboard(rows(row('B', grid(['a', 0, 0])), row('C', grid(['b', 0, 0]))), panels);
      const structure = structureOf(before, after);

      // B keeps its identity through its title even though A's panel is in it now.
      expect(nodeByLabel(structure, 'Row "B"').id).toBe('section:layout/spec/rows/0');
      expect(nodeByLabel(structure, 'Panel "CPU"').moveText).toBe('moved from Row "A" to Row "B"');
      expect(nodeByLabel(structure, 'Row "A"').status).toBe('removed');
      expect(nodeByLabel(structure, 'Row "C"').status).toBe('added');
    });

    it('matches empty sections at the same position as a title change', () => {
      const before = dashboard(rows(row('Old', grid())), {});
      const after = dashboard(rows(row('New', grid())), {});

      expect(changeList(structureOf(before, after))).toEqual(['Row "New": title changed']);
    });

    it('only matches nested sections under matched parents', () => {
      const before = dashboard(tabs(tab('T1', rows(row('R', grid(['a', 0, 0]))))), { a: 'CPU' });
      const after = dashboard(tabs(tab('T2', rows(row('R', grid(['b', 0, 0]))))), { b: 'Memory' });
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
      const before = dashboard(
        rows(row('A', grid(['a', 0, 0])), row('B', grid(['b', 0, 0])), row('C', grid(['c', 12, 0], ['d', 0, 0]))),
        panels
      );
      const after = dashboard(rows(row('A', grid(['a', 0, 0])), row('C', grid(['c', 12, 0], ['d', 0, 0]))), {
        a: 'CPU',
        c: 'Disk',
        d: 'Network',
      });
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
      const before = dashboard(rows(row('A', grid()), row('B', grid())), {});
      const after = dashboard(rows(row('B', grid())), {});

      expect(outline(structureOf(before, after))).toEqual(['Dashboard', '- Row "A"', 'Row "B"']);
    });

    it('puts removed panels at their baseline position within their section', () => {
      const before = dashboard(grid(['a', 0, 0], ['b', 0, 8], ['c', 0, 16]), { a: 'A', b: 'B', c: 'C' });
      const after = dashboard(grid(['a', 0, 0], ['c', 0, 16]), { a: 'A', c: 'C' });

      expect(outline(structureOf(before, after))).toEqual(['Dashboard', 'Panel "A"', '- Panel "B"', 'Panel "C"']);
    });
  });

  describe('statuses', () => {
    it('marks added and removed panels, claiming the element and its layout item', () => {
      const before = dashboard(grid(['a', 0, 0], ['b', 0, 8]), { a: 'CPU', b: 'Memory' });
      const after = dashboard(grid(['a', 0, 0], ['c', 0, 8]), { a: 'CPU', c: 'Disk' });
      const structure = structureOf(before, after);

      expect(nodeByLabel(structure, 'Panel "Disk"')).toMatchObject({ status: 'added' });
      expect(nodeByLabel(structure, 'Panel "Memory"')).toMatchObject({ status: 'removed' });
      expect(
        [...nodeByLabel(structure, 'Panel "Disk"').claims, ...nodeByLabel(structure, 'Panel "Memory"').claims].sort()
      ).toEqual(['elements/b', 'elements/c', 'layout/spec/items/1/spec/element/name']);
      expect(structure.changes).toEqual([]);
    });

    it('marks a removed section and lists the panels and nested sections removed with it', () => {
      const before = dashboard(
        rows(row('Keep', grid(['a', 0, 0])), row('API', tabs(tab('Inner', grid(['b', 0, 0], ['c', 0, 8]))))),
        panels
      );
      const after = dashboard(rows(row('Keep', grid(['a', 0, 0], ['c', 0, 8]))), { a: 'CPU', c: 'Disk' });
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
      const before = dashboard(rows(row('Keep', grid(['a', 0, 0]))), { a: 'CPU' });
      const after = dashboard(rows(row('Keep', grid(['a', 0, 0])), row('New', grid(['b', 0, 0]))), {
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
      const before = dashboard(rows(row('API', grid(['a', 0, 0], ['b', 0, 8])), row('DB', grid(['c', 0, 0]))), panels);
      const after = dashboard(rows(row('API', grid(['a', 0, 0])), row('DB', grid(['c', 0, 0], ['b', 0, 8]))), panels);
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
      const before = dashboard(
        rows(row('API', grid(['a', 0, 0], ['b', 0, 8], ['c', 0, 16])), row('DB', grid())),
        panels
      );
      const after = dashboard(
        rows(row('Backend', grid(['a', 0, 0], ['b', 0, 8])), row('DB', grid(['c', 0, 0]))),
        panels
      );

      expect(nodeByLabel(structureOf(before, after), 'Panel "Disk"').moveText).toBe(
        'moved from Row "Backend" to Row "DB"'
      );
    });
  });

  describe('ambiguous names', () => {
    it('drops the position from a moved node header and ends the move text with its new position', () => {
      const titles = { a: 'New panel', b: 'New panel', c: 'Latency' };
      const before = dashboard(autoGrid(['a', 'b', 'c']), titles);
      const after = dashboard(autoGrid(['b', 'a', 'c']), titles);

      expect(outline(structureOf(before, after))).toEqual([
        'Dashboard',
        'Panel "New panel" moved before Panel "New panel", at position 1',
        'Panel "New panel" at position 2',
        'Panel "Latency"',
      ]);
    });

    it('does the same for a moved section with a shared title', () => {
      const before = dashboard(rows(row('Dup', grid(['a', 0, 0])), row('Dup', grid(['b', 0, 0]))), panels);
      const after = dashboard(rows(row('Dup', grid(['b', 0, 0])), row('Dup', grid(['a', 0, 0]))), panels);
      const structure = structureOf(before, after);

      // Title matching pairs the k-th 'Dup' with the k-th, so only their panels moved.
      expect(structure.nodes.filter((n) => n.status).map((n) => `${n.label} ${moveStatusText(n)}`)).toEqual([
        'Panel "Memory" moved from Row "Dup" at position 2 to Row "Dup" at position 1',
        'Panel "CPU" moved from Row "Dup" at position 1 to Row "Dup" at position 2',
      ]);

      const tabbed = (order: string[]) =>
        dashboard(tabs(tab('Cluster', rows(...order.map((title) => row(title, grid()))))), {});
      const moved = structureOf(tabbed(['X', 'Dup', 'Dup']), tabbed(['Dup', 'X', 'Dup']));
      expect(moved.nodes.filter((n) => n.status).map((n) => `${n.label} ${moveStatusText(n)}`)).toEqual([
        // On a tie the earlier baseline section (X) stays put.
        'Tab "Cluster" › Row "Dup" moved before Row "X", at position 1',
      ]);
    });

    it('gives panels an owner label with their section when the title is not unique in the dashboard', () => {
      const titles = { a: 'Errors', b: 'Errors', c: 'Errors', d: 'Unique', e: '' };
      const layout = tabs(
        tab('API', grid(['a', 0, 0], ['d', 0, 8])),
        tab('DB', grid(['b', 0, 0], ['c', 0, 8], ['e', 0, 16]))
      );
      const structure = structureOf(dashboard(layout, titles), dashboard(layout, titles));
      const owner = (name: string) => structure.nodes.find((n) => n.elementName === name)?.ownerLabel;

      expect(['a', 'b', 'c', 'd', 'e'].map(owner)).toEqual([
        'Panel "Errors" in Tab "API"',
        'Panel "Errors" at position 1 in Tab "DB"',
        'Panel "Errors" at position 2 in Tab "DB"',
        'Panel "Unique"',
        'Panel (unnamed)',
      ]);

      const root = structureOf(
        dashboard(grid(['a', 0, 0], ['b', 0, 8]), titles),
        dashboard(grid(['a', 0, 0], ['b', 0, 8]), titles)
      );
      expect(root.nodes.filter((n) => n.kind === 'panel').map((n) => n.ownerLabel)).toEqual(
        expect.arrayContaining(['Panel "Errors" at position 1', 'Panel "Errors" at position 2'])
      );
    });

    it('names nested sections removed with a section relative to it, and panels by their baseline name', () => {
      const before = dashboard(
        rows(row('Keep', grid()), row('API', tabs(tab('Inner', rows(row('Deep', grid(['a', 0, 0], ['b', 0, 8]))))))),
        { a: 'New panel', b: 'New panel' }
      );
      const after = dashboard(rows(row('Keep', grid())), {});

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
      const before = dashboard(rows(row('API', grid(['a', 0, 0])), row('DB', grid(['b', 0, 0]))), panels);
      const after = dashboard(tabs(tab('DB', grid(['b', 0, 0])), tab('API', grid(['a', 0, 0]))), panels);
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
      expect(structure.nodes.filter((n) => n.status)).toMatchObject([
        { label: 'Tab "DB"', status: 'moved', moveText: 'moved before Tab "API"', claims: [] },
      ]);
    });

    it('still reports a move between two sections that survive a rows to tabs change', () => {
      const before = dashboard(rows(row('API', grid(['a', 0, 0], ['b', 0, 8])), row('DB', grid())), panels);
      const after = dashboard(tabs(tab('API', grid(['a', 0, 0])), tab('DB', grid(['b', 0, 0]))), panels);

      expect(nodeByLabel(structureOf(before, after), 'Panel "Memory"').moveText).toBe(
        'moved from Tab "API" to Tab "DB"'
      );
    });

    it('keeps the identity of rows wrapped into a new tab', () => {
      const before = dashboard(rows(row('API', grid(['a', 0, 0])), row('DB', grid(['b', 0, 0]))), panels);
      const after = dashboard(
        tabs(tab('New tab', rows(row('API', grid(['a', 0, 0])), row('DB', grid(['b', 0, 0]))))),
        panels
      );
      const structure = structureOf(before, after);

      expect(changeList(structure)).toEqual(['Dashboard: Layout: changed from rows to tabs']);
      expect(structure.nodes.filter((n) => n.status).map((n) => n.label)).toEqual(['Tab "New tab"']);
    });

    it('keeps the identity of rows unwrapped from a removed tab', () => {
      const before = dashboard(
        tabs(tab('Wrapper', rows(row('API', grid(['a', 0, 0])), row('DB', grid(['b', 0, 0]))))),
        panels
      );
      const after = dashboard(rows(row('API', grid(['a', 0, 0])), row('DB', grid(['b', 0, 0]))), panels);
      const structure = structureOf(before, after);

      expect(changeList(structure)).toEqual(['Dashboard: Layout: changed from tabs to rows']);
      expect(structure.nodes.filter((n) => n.status)).toMatchObject([
        { label: 'Tab "Wrapper"', status: 'removed', removedContents: [] },
      ]);
    });

    it('marks a panel added inside the new rows of a restructure as added, claiming only its element', () => {
      const before = dashboard(grid(['a', 0, 0]), only('a'));
      const after = dashboard(rows(row('Overview', grid(['a', 0, 0], ['b', 0, 8]))), only('a', 'b'));
      const structure = structureOf(before, after);

      expect(nodeByLabel(structure, 'Panel "Memory"')).toMatchObject({ status: 'added', claims: ['elements/b'] });
      expect(nodeByLabel(structure, 'Panel "CPU"').status).toBeUndefined();
    });

    it('reports grid to rows without moving every panel; the new rows are added', () => {
      const before = dashboard(grid(['a', 0, 0], ['b', 0, 8]), { a: 'CPU', b: 'Memory' });
      const after = dashboard(rows(row('Overview', grid(['a', 0, 0], ['b', 0, 8]))), { a: 'CPU', b: 'Memory' });
      const structure = structureOf(before, after);

      expect(changeList(structure)).toEqual(['Dashboard: Layout: changed from custom grid to rows']);
      expect(outline(structure)).toEqual(['Dashboard', '+ Row "Overview"', '  Panel "CPU"', '  Panel "Memory"']);
      expect(nodeByLabel(structure, 'Row "Overview"').claims).toEqual([]);
    });

    it('reports rows to grid without moving every panel; the old rows are removed', () => {
      const before = dashboard(
        rows(row('A', grid(['a', 0, 0])), row('B', grid(['b', 0, 0], ['c', 0, 8]))),
        only('a', 'b', 'c')
      );
      const after = dashboard(grid(['a', 0, 0], ['b', 0, 8]), only('a', 'b'));
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
      const before = dashboard(tabs(tab('Cluster', grid(['a', 0, 0], ['b', 0, 8]))), panels);
      const after = dashboard(tabs(tab('Cluster', autoGrid(['a', 'b']))), panels);
      const structure = structureOf(before, after);

      expect(changeList(structure)).toEqual(['Tab "Cluster": Layout: changed from custom grid to auto grid']);
      expect(structure.changes[0]).toMatchObject({ nodeId: 'section:layout/spec/tabs/0', category: 'layout' });
    });

    it('reports a nested section move and auto grid settings on the owning sections', () => {
      const before = dashboard(
        tabs(tab('Cluster', rows(row('A', grid()), row('B', autoGrid(['a'], { maxColumnCount: 3 }))))),
        panels
      );
      const after = dashboard(
        tabs(tab('Cluster', rows(row('B', autoGrid(['a'], { maxColumnCount: 2 })), row('A', grid())))),
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
      const before = dashboard(grid(['a', 0, 0], ['b', 0, 8], ['c', 0, 16], ['d', 0, 24]), only('a', 'b', 'c', 'd'));
      const after = dashboard(grid(['b', 0, 0], ['c', 0, 8], ['d', 0, 16]), only('b', 'c', 'd'));
      const structure = structureOf(before, after);

      expect(structure.changes).toEqual([]);
      expect(nodeByLabel(structure, 'Panel "CPU"').claims).toContain('layout/spec/items/3');
      expect(structure.nodes.filter((n) => n.claims.length).map((n) => n.label)).toEqual(['Panel "CPU"']);
    });

    it('does not report panels pushed down by an inserted panel', () => {
      const before = dashboard(grid(['a', 0, 0], ['b', 0, 8]), only('a', 'b'));
      const after = dashboard(grid(['c', 0, 0], ['a', 0, 8], ['b', 0, 16]), only('a', 'b', 'c'));
      const structure = structureOf(before, after);

      expect(structure.changes).toEqual([]);
      expect(structure.nodes.filter((n) => n.claims.length).map((n) => n.label)).toEqual(['Panel "Disk"']);
    });

    it('claims shifted rows with the removed row', () => {
      const before = dashboard(
        rows(row('A', grid(['a', 0, 0])), row('B', grid(['b', 0, 0])), row('C', grid(['c', 0, 0]))),
        only('a', 'b', 'c')
      );
      const after = dashboard(rows(row('B', grid(['b', 0, 0])), row('C', grid(['c', 0, 0]))), only('b', 'c'));
      const structure = structureOf(before, after);

      expect(structure.changes).toEqual([]);
      expect(structure.nodes.filter((n) => n.claims.length).map((n) => n.label)).toEqual(['Row "A"']);
    });

    it('claims shifted auto grid items with the inserted panel', () => {
      const before = dashboard(autoGrid(['a', 'b', 'c']), only('a', 'b', 'c'));
      const after = dashboard(autoGrid(['d', 'a', 'b', 'c']), only('a', 'b', 'c', 'd'));
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
      const before = dashboard(rows(row('API', grid(['a', 0, 0]))), panels);
      const after = dashboard(
        rows(
          row('API', grid(['a', 0, 0]), {
            hideHeader: true,
            collapse: true,
            fillScreen: true,
            repeat: { mode: 'variable', value: 'env' },
            conditionalRendering: condition as never,
            variables: [variable as never],
            annotations: [],
          })
        ),
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
      const before = dashboard(tabs(tab('T', grid(), { variables: [v('a'), v('b')] })), {});
      const after = dashboard(tabs(tab('T', grid(), { variables: [v('b')] })), {});
      const structure = structureOf(before, after);

      expect(structure.changes).toMatchObject([
        { field: 'variables', kind: 'changed', before: [v('a'), v('b')], after: [v('b')] },
      ]);
      expect(structure.changes[0].claims.length).toBe(layoutDiffsOf(before, after).length);
    });

    it('reports panel position and size from its grid item', () => {
      const before = dashboard(grid(['a', 0, 0, 12, 8], ['b', 12, 0, 12, 8]), panels);
      const after = dashboard(grid(['a', 0, 0, 24, 8], ['b', 0, 8, 12, 8]), panels);
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
      const before = dashboard(grid(['a', 0, 0, 12, 8], ['b', 0, 8, 12, 8]), panels);
      const after = dashboard(grid(['a', 0, 0, 12, 16], ['b', 0, 16, 12, 8]), panels);
      const structure = structureOf(before, after);

      expect(changeList(structure)).toEqual(['Panel "CPU": size changed']);
      expect(structure.changes[0].claims.sort()).toEqual([
        'layout/spec/items/0/spec/height',
        'layout/spec/items/1/spec/y',
      ]);
    });

    it('reports a panel dragged past others as moved, not as a position change of every panel', () => {
      const before = dashboard(grid(['a', 0, 0], ['b', 0, 8], ['c', 0, 16]), panels);
      const after = dashboard(grid(['b', 0, 0], ['c', 0, 8], ['a', 0, 16]), panels);
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
      const before = dashboard(grid(['a', 0, 0], ['b', 0, 8]), only('a', 'b'));
      const after = dashboard(grid(['a', 0, 0], ['b', 12, 8]), only('a', 'b'));
      const structure = structureOf(before, after);

      expect(changeList(structure)).toEqual(['Panel "Memory": position changed']);
      expect(structure.nodes.filter((n) => n.status)).toEqual([]);
    });

    it('keeps the panel whose coordinates did not change in place on a tie', () => {
      const before = dashboard(grid(['a', 0, 0], ['b', 0, 8]), only('a', 'b'));
      const after = dashboard(grid(['b', 0, 8], ['a', 0, 16]), only('a', 'b'));
      const structure = structureOf(before, after);

      expect(outline(structure)).toEqual(['Dashboard', 'Panel "Memory"', 'Panel "CPU" moved after Panel "Memory"']);
    });

    it('keeps the earlier baseline item in place on a tie, and words a move to the front by the next item', () => {
      const before = dashboard(autoGrid(['a', 'b', 'c']), only('a', 'b', 'c'));
      const after = dashboard(autoGrid(['c', 'a', 'b']), only('a', 'b', 'c'));
      const structure = structureOf(before, after);

      expect(outline(structure)).toEqual([
        'Dashboard',
        'Panel "Disk" moved before Panel "CPU"',
        'Panel "CPU"',
        'Panel "Memory"',
      ]);
      expect(structure.changes).toEqual([]);

      const swapped = structureOf(
        dashboard(autoGrid(['a', 'b']), only('a', 'b')),
        dashboard(autoGrid(['b', 'a']), only('a', 'b'))
      );
      expect(outline(swapped)).toEqual(['Dashboard', 'Panel "Memory" moved before Panel "CPU"', 'Panel "CPU"']);
    });

    it('names the top level of the dashboard as an end of a move, and leaves statusText to describe/', () => {
      const before = dashboard(rows(row('API', grid(['a', 0, 0])), row('DB', grid(['b', 0, 0]))), only('a', 'b'));
      const after = dashboard(rows(row('API', grid()), row('DB', grid(['b', 0, 0], ['a', 0, 8]))), only('a', 'b'));
      const node = nodeByLabel(structureOf(before, after), 'Panel "CPU"');

      expect(node).toMatchObject({
        status: 'moved',
        moveText: 'moved from Row "API" to Row "DB", after Panel "Memory"',
      });
      expect(node.movePosition).toBeUndefined();
    });

    it('words a move into another section by its neighbour there, or alone', () => {
      const before = dashboard(
        rows(row('API', grid(['a', 0, 0], ['b', 0, 8])), row('DB', grid(['c', 0, 0])), row('Empty', grid())),
        panels
      );
      const after = dashboard(
        rows(row('API', grid()), row('DB', grid(['a', 0, 0], ['c', 0, 8])), row('Empty', grid(['b', 0, 0]))),
        panels
      );
      const structure = structureOf(before, after);

      expect(nodeByLabel(structure, 'Panel "CPU"').moveText).toBe(
        'moved from Row "API" to Row "DB", before Panel "Disk"'
      );
      expect(nodeByLabel(structure, 'Panel "Memory"').moveText).toBe('moved from Row "API" to Row "Empty"');
    });

    it('reports auto grid item repeat, show/hide rules and fit content', () => {
      const before = dashboard(autoGrid(['a']), panels);
      const condition = {
        kind: 'ConditionalRenderingGroup',
        spec: { visibility: 'hide', condition: 'and', items: [] },
      };
      const after = dashboard(
        autoGrid([
          {
            name: 'a',
            repeat: { mode: 'variable', value: 'env' },
            fitContent: true,
            conditionalRendering: condition as never,
          },
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
      const before = dashboard(autoGrid(['a'], { maxColumnCount: 3 }), panels);
      const after = dashboard(
        autoGrid(['a'], { maxColumnCount: 4, columnWidthMode: 'wide', fillScreen: true }),
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
        const before = dashboard(grid(['a', 0, 0]), only('a'));
        const after = dashboard(grid(['a', 0, 0], [name, 0, 8]), { ...only('a') });
        after.elements = { ...after.elements };
        Object.defineProperty(after.elements, name, {
          value: dashboard(grid(), { x: 'Odd' }).elements.x,
          enumerable: true,
          writable: true,
          configurable: true,
        });
        const structure = structureOf(before, after);

        expect(structure.nodes.find((n) => n.elementName === name)).toMatchObject({
          label: 'Panel "Odd"',
          status: 'added',
        });
        expect(structure.changes).toEqual([]);

        const removed = structureOf(after, before);
        expect(removed.nodes.find((n) => n.elementName === name)).toMatchObject({ status: 'removed' });
        expect(removed.changes).toEqual([]);
      }
    );

    it('names an unknown layout kind from the kind itself and claims its diffs', () => {
      const before = dashboard(grid(['a', 0, 0]), only('a'));
      const after = dashboard(
        { kind: 'MasonryLayout', spec: { columns: 3 } } as unknown as ReturnType<typeof grid>,
        only('a')
      );
      const structure = structureOf(before, after);

      expect(changeList(structure)).toEqual(['Dashboard: Layout: changed from custom grid to Masonry layout']);
    });

    it('walks an unknown layout kind on both sides without throwing, claiming its diffs', () => {
      const unknown = (columns: number) =>
        ({ kind: 'MasonryLayout', spec: { columns, items: [{ odd: true }] } }) as unknown as ReturnType<typeof grid>;
      const structure = structureOf(dashboard(unknown(3), {}), dashboard(unknown(4), {}));

      expect(structure.changes).toMatchObject([
        { nodeId: 'dashboard', field: 'layoutSettings', text: 'Layout: changed', claims: ['layout/spec/columns'] },
      ]);
    });
  });

  describe('claims', () => {
    const cases: Array<[string, DashboardV2Spec, DashboardV2Spec]> = [
      ['no change', dashboard(grid(['a', 0, 0]), panels), dashboard(grid(['a', 0, 0]), panels)],
      [
        'nested everything',
        dashboard(
          tabs(
            tab('T1', rows(row('R1', grid(['a', 0, 0], ['b', 0, 8])), row('R2', autoGrid(['c'])))),
            tab('T2', grid(['d', 0, 0]))
          ),
          panels
        ),
        dashboard(
          tabs(
            tab('T2', grid(['d', 0, 8], ['e', 0, 0])),
            tab('T1 renamed', rows(row('R2', autoGrid(['c', 'b'], { fillScreen: true })), row('R3', grid(['f', 0, 0]))))
          ),
          { ...panels, f: 'New' }
        ),
      ],
      [
        'root kind and nested changes at once',
        dashboard(rows(row('A', tabs(tab('X', grid(['a', 0, 0]))))), panels),
        dashboard(autoGrid(['a', 'b']), panels),
      ],
      ['new dashboard', dashboard(grid(), {}), dashboard(rows(row('A', grid(['a', 0, 0]))), { a: 'CPU' })],
    ];

    it.each(cases)('claims every diff exactly once: %s', (_, before, after) => {
      const diffs = layoutDiffsOf(before, after);
      expect(claimProblems(buildStructure(before, after, diffs), diffs)).toEqual([]);
    });

    it('the claim helper reports unclaimed, doubly claimed and phantom claims', () => {
      const before = dashboard(grid(['a', 0, 0]), panels);
      const after = dashboard(grid(['a', 0, 8]), panels);
      const diffs = layoutDiffsOf(before, after);
      const structure = buildStructure(before, after, diffs);
      structure.changes[0].claims.push('layout/spec/items/0', 'layout/nothing');

      expect(claimProblems(structure, diffs)).toEqual([
        'layout/spec/items/0/spec/y: claimed 2 times (change panel:a/position, change panel:a/position)',
        'layout/nothing: phantom claim by change panel:a/position',
      ]);
      expect(claimProblems({ ...structure, changes: [] }, diffs)).toEqual([
        'layout/spec/items/0/spec/y: claimed 0 times',
      ]);
    });
  });
});
