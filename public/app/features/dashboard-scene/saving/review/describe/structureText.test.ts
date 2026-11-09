import { named, richToPlain } from '../richText';
import { type RawChange, type ReviewNode, type RichText } from '../types';

import {
  countChanges,
  describeMetadata,
  describeRawChange,
  nodeStatusText,
  nodeSummary,
  overviewLine,
  type RawChangeContext,
} from './structureText';

// --- Structure changes ---

const ctx: RawChangeContext = { diffsUnder: () => [], nodes: [], list: { isDefault: () => false } };

const texts = (raw: Partial<RawChange> & Pick<RawChange, 'field'>) =>
  describeRawChange({ nodeId: 'p1', category: 'layout', kind: 'changed', claims: ['c'], ...raw }, ctx).map(
    ({ change }) => ({
      text: change.text,
      details: { before: change.details?.before?.(), after: change.details?.after?.() },
    })
  );

describe('describeRawChange', () => {
  it('words a size change in words, with the numbers on demand', () => {
    expect(texts({ field: 'size', before: { width: 12, height: 8 }, after: { width: 24, height: 10 } })).toEqual([
      { text: 'Size: wider and taller', details: { before: '12 × 8', after: '24 × 10' } },
    ]);
  });

  it('words a position change by direction, vertical first', () => {
    expect(texts({ field: 'position', before: { x: 12, y: 0 }, after: { x: 0, y: 8 } })[0].text).toBe(
      'Position: moved down and left'
    );
  });

  it('reads a missing auto grid setting as its default', () => {
    const matchRowHeights = {
      field: 'layoutSettings' as const,
      subField: 'matchRowHeights',
      category: 'layout' as const,
    };

    expect(texts({ ...matchRowHeights, before: false, after: undefined })[0].text).toBe('Match row heights: turned on');
    expect(texts({ ...matchRowHeights, before: undefined, after: false })[0].text).toBe(
      'Match row heights: turned off'
    );
  });

  it("reads a panel's missing fit content as following the layout", () => {
    expect(texts({ field: 'fitContent', before: false, after: undefined })[0].text).toBe(
      'Fit content: set to follow the layout'
    );
  });

  it('splits a panel repeat into its settings', () => {
    expect(
      texts({ field: 'repeat', before: undefined, after: { mode: 'variable', value: 'env', direction: 'h' } }).map(
        ({ text }) => text
      )
    ).toEqual(['Repeat by variable: set to env', 'Repeat direction: set to horizontal']);
  });
});

// --- Overview ---

describe('overviewLine', () => {
  it.each([
    [true, 0, 0, 0, 'Changes to the dashboard'],
    [false, 0, 0, 1, 'Changes to 1 panel'],
    [false, 0, 1, 0, 'Changes to 1 tab'],
    [true, 0, 0, 1, 'Changes to the dashboard and 1 panel'],
    [true, 2, 0, 4, 'Changes to the dashboard, 2 rows, and 4 panels'],
    [false, 1, 0, 0, 'Changes to 1 row'],
    [false, 0, 0, 0, ''],
  ])('dashboard %s, %s rows, %s tabs, %s panels', (dashboard, rows, tabs, panels, line) => {
    expect(overviewLine(dashboard, { rows, tabs, panels })).toBe(line);
  });
});

describe('overviewLine for a new dashboard', () => {
  it.each([
    [true, 0, 0, 2, 'The dashboard and 2 panels'],
    [true, 0, 1, 2, 'The dashboard, 1 tab, and 2 panels'],
    [false, 0, 0, 2, '2 panels'],
  ])('dashboard %s, %s rows, %s tabs, %s panels', (dashboard, rows, tabs, panels, line) => {
    expect(overviewLine(dashboard, { rows, tabs, panels }, true)).toBe(line);
  });
});

const plain = (text: RichText | undefined) => (text ? richToPlain(text) : undefined);

describe('nodeStatusText', () => {
  it('says how many lines changed, with plurals', () => {
    expect(plain(nodeStatusText(undefined, undefined, 1))).toBe('was updated (1 change)');
    expect(plain(nodeStatusText(undefined, undefined, 3))).toBe('was updated (3 changes)');
  });

  it('adds the update to the move text', () => {
    const move = { text: ['moved after ', named('panel', 'Latency')] };

    expect(plain(nodeStatusText('moved', move, 0))).toBe('moved after Panel "Latency"');
    expect(plain(nodeStatusText('moved', move, 1))).toBe('moved after Panel "Latency" and was updated (1 change)');
  });

  it("ends an ambiguous node's move with its new position", () => {
    const move = { text: ['moved before ', named('panel', 'New panel')], position: 1 };

    expect(plain(nodeStatusText('moved', move, 0))).toBe('moved before Panel "New panel", at position 1');
    expect(plain(nodeStatusText('moved', move, 2))).toBe(
      'moved before Panel "New panel", at position 1, and was updated (2 changes)'
    );
    // The neighbour stays a named element, so the UI can show its icon.
    expect(nodeStatusText('moved', move, 0)).toEqual(['moved before ', named('panel', 'New panel'), ', at position 1']);
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
        label: ['Dashboard'],
        summary: '',
        claims: [],
        categories: [{ category: 'properties', label: 'Properties', changes: [change('changed'), change('added')] }],
      },
      {
        kind: 'section',
        sectionKind: 'row',
        id: 'row',
        label: [named('row', 'API')],
        summary: '',
        claims: [],
        categories: [],
        children: [
          {
            kind: 'panel',
            id: 'p1',
            label: [named('panel', 'A')],
            status: 'moved',
            summary: '',
            claims: [],
            categories: [],
          },
          {
            kind: 'panel',
            id: 'p2',
            label: [named('panel', 'B')],
            status: 'removed',
            summary: '',
            claims: [],
            categories: [],
          },
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
