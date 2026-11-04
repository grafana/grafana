import { autoGrid, grid, row, rows, tab, tabs } from './testUtils';
import { walkLayout } from './walkLayout';

describe('walkLayout', () => {
  it('reads grid items by (y, x), not array order', () => {
    const walked = walkLayout(grid(['c', 0, 8], ['b', 12, 0], ['a', 0, 0]));

    expect(walked.placements.map((p) => [p.elementName, p.path, p.order])).toEqual([
      ['a', 'layout/spec/items/2', 0],
      ['b', 'layout/spec/items/1', 1],
      ['c', 'layout/spec/items/0', 2],
    ]);
  });

  it('reads auto grid items in array order', () => {
    const walked = walkLayout(autoGrid(['b', 'a']));

    expect(walked.placements.map((p) => [p.elementName, p.layoutKind, p.index])).toEqual([
      ['b', 'AutoGridLayout', 0],
      ['a', 'AutoGridLayout', 1],
    ]);
  });

  it('walks rows and tabs at any depth, depth first, with their spec paths and parents', () => {
    const walked = walkLayout(
      tabs(
        tab('Cluster', rows(row('Nodes', grid(['n1', 0, 0])), row('Pods', autoGrid(['p1'])))),
        tab('API', grid(['a1', 0, 0]))
      )
    );

    expect(walked.sections.map((s) => [s.kind, s.title, s.path, s.parentPath, s.index])).toEqual([
      ['tab', 'Cluster', 'layout/spec/tabs/0', undefined, 0],
      ['row', 'Nodes', 'layout/spec/tabs/0/spec/layout/spec/rows/0', 'layout/spec/tabs/0', 0],
      ['row', 'Pods', 'layout/spec/tabs/0/spec/layout/spec/rows/1', 'layout/spec/tabs/0', 1],
      ['tab', 'API', 'layout/spec/tabs/1', undefined, 1],
    ]);
    expect(walked.placements.map((p) => [p.elementName, p.sectionPath, p.path])).toEqual([
      [
        'n1',
        'layout/spec/tabs/0/spec/layout/spec/rows/0',
        'layout/spec/tabs/0/spec/layout/spec/rows/0/spec/layout/spec/items/0',
      ],
      [
        'p1',
        'layout/spec/tabs/0/spec/layout/spec/rows/1',
        'layout/spec/tabs/0/spec/layout/spec/rows/1/spec/layout/spec/items/0',
      ],
      ['a1', 'layout/spec/tabs/1', 'layout/spec/tabs/1/spec/layout/spec/items/0'],
    ]);
  });

  it('treats a missing or blank title as untitled', () => {
    const walked = walkLayout(rows(row(undefined, grid()), row('  ', grid())));

    expect(walked.sections.map((s) => s.title)).toEqual(['', '']);
  });
});
