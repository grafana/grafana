import { type ReviewNode } from '../types';

import { countChanges, describeMetadata, nodeStatusText, nodeSummary, overviewLine } from './overview';

describe('overviewLine', () => {
  it.each([
    [true, 0, 0, 'Changes to the dashboard'],
    [false, 0, 1, 'Changes to 1 panel'],
    [true, 0, 1, 'Changes to the dashboard and 1 panel'],
    [true, 2, 4, 'Changes to the dashboard, 2 sections, and 4 panels'],
    [false, 1, 0, 'Changes to 1 section'],
    [false, 0, 0, ''],
  ])('dashboard %s, %s sections, %s panels', (dashboard, sections, panels, line) => {
    expect(overviewLine(dashboard, sections, panels)).toBe(line);
  });
});

describe('overviewLine for a new dashboard', () => {
  it.each([
    [true, 0, 2, 'The dashboard and 2 panels'],
    [true, 1, 2, 'The dashboard, 1 section, and 2 panels'],
    [false, 0, 2, '2 panels'],
  ])('dashboard %s, %s sections, %s panels', (dashboard, sections, panels, line) => {
    expect(overviewLine(dashboard, sections, panels, true)).toBe(line);
  });
});

describe('nodeStatusText', () => {
  it('says how many lines changed, with plurals', () => {
    expect(nodeStatusText(undefined, undefined, 1)).toBe('was updated (1 change)');
    expect(nodeStatusText(undefined, undefined, 3)).toBe('was updated (3 changes)');
  });

  it('adds the update to the move text', () => {
    const move = { text: 'moved after Panel "Latency"' };

    expect(nodeStatusText('moved', move, 0)).toBe('moved after Panel "Latency"');
    expect(nodeStatusText('moved', move, 1)).toBe('moved after Panel "Latency" and was updated (1 change)');
  });

  it("ends an ambiguous node's move with its new position", () => {
    const move = { text: 'moved before Panel "New panel"', position: 1 };

    expect(nodeStatusText('moved', move, 0)).toBe('moved before Panel "New panel", at position 1');
    expect(nodeStatusText('moved', move, 2)).toBe(
      'moved before Panel "New panel", at position 1, and was updated (2 changes)'
    );
  });

  it('has none for added, removed and header-only nodes', () => {
    expect(nodeStatusText('added', undefined, 2)).toBeUndefined();
    expect(nodeStatusText('removed', undefined, 0)).toBeUndefined();
    expect(nodeStatusText(undefined, undefined, 0)).toBeUndefined();
  });
});

describe('nodeSummary', () => {
  it('lists changed categories in lowercase, as a unit list', () => {
    expect(nodeSummary(['data', 'fieldConfig'])).toBe('data, field config');
    expect(nodeSummary(['properties'])).toBe('properties');
    expect(nodeSummary([])).toBe('');
  });
});

describe('countChanges', () => {
  it('counts every change line, every node status once, and metadata', () => {
    const change = (kind: 'added' | 'changed' | 'removed') => ({ kind, text: '', claims: [] });
    const tree: ReviewNode[] = [
      {
        kind: 'dashboard',
        id: 'dashboard',
        label: 'Dashboard',
        summary: '',
        claims: [],
        categories: [{ category: 'properties', label: 'Properties', changes: [change('changed'), change('added')] }],
      },
      {
        kind: 'section',
        sectionKind: 'row',
        id: 'row',
        label: "'API' row",
        summary: '',
        claims: [],
        categories: [],
        children: [
          { kind: 'panel', id: 'p1', label: "'A'", status: 'moved', summary: '', claims: [], categories: [] },
          { kind: 'panel', id: 'p2', label: "'B'", status: 'removed', summary: '', claims: [], categories: [] },
        ],
      },
    ];

    expect(countChanges(tree, [change('changed')])).toEqual({ added: 1, changed: 2, removed: 1, moved: 1 });
  });
});

describe('describeMetadata', () => {
  it('words a folder move and predefined variables, with fallbacks for missing values', () => {
    expect(
      describeMetadata({ folder: { after: 'Ops' }, predefinedVariables: { before: undefined, after: 'All / All' } })
    ).toEqual([
      { kind: 'changed', text: 'Folder: Dashboards → Ops', claims: [] },
      { kind: 'changed', text: 'Predefined variables: None → All / All', claims: [] },
    ]);
  });

  it('is empty when nothing outside the spec changed', () => {
    expect(describeMetadata(undefined)).toEqual([]);
  });
});
