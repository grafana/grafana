import { type RawChange } from '../types';

import { describeRawChange, type RawChangeContext } from './structureChanges';

const ctx: RawChangeContext = { diffsUnder: () => [], nodes: [], list: { isDefault: () => false } };

const texts = (raw: Partial<RawChange> & Pick<RawChange, 'field'>) =>
  describeRawChange({ nodeId: 'p1', category: 'layout', kind: 'changed', claims: ['c'], ...raw }, ctx).map(
    ({ change }) => ({ text: change.text, details: change.details })
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
