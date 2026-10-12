import { applySelectionClick, getSelectedIndices, type SelectionClickInput } from './selection';

const categories = ['a', 'b', 'c', 'd', 'e'];

function click(overrides: Partial<SelectionClickInput>) {
  return applySelectionClick({
    categories,
    current: undefined,
    clicked: 'a',
    toggle: false,
    ...overrides,
  });
}

describe('applySelectionClick', () => {
  describe('replace (the tooltip filter action)', () => {
    it('selects only the clicked value', () => {
      expect(click({ current: ['a', 'b'], clicked: 'd' })).toEqual({ values: ['d'], mode: 'replace' });
    });

    it('keeps the clicked value when it is already the sole selection', () => {
      expect(click({ current: ['c'], clicked: 'c' })).toEqual({ values: ['c'], mode: 'replace' });
    });

    it('starts a selection when the panel owns none', () => {
      expect(click({ current: undefined, clicked: 'b' })).toEqual({ values: ['b'], mode: 'replace' });
    });
  });

  describe('toggle (Alt-click)', () => {
    it('starts a selection when the panel owns none', () => {
      expect(click({ toggle: true, current: undefined, clicked: 'c' })).toEqual({ values: ['c'], mode: 'toggle' });
    });

    it('adds a value in display order', () => {
      expect(click({ toggle: true, current: ['d'], clicked: 'b' })).toEqual({ values: ['b', 'd'], mode: 'toggle' });
    });

    it('removes a selected value', () => {
      expect(click({ toggle: true, current: ['b', 'd'], clicked: 'd' })).toEqual({ values: ['b'], mode: 'toggle' });
    });

    it('clears the selection when removing the last value', () => {
      expect(click({ toggle: true, current: ['b'], clicked: 'b' })).toEqual({ values: [], mode: 'toggle' });
    });

    it('keeps selected values missing from the data at the end', () => {
      expect(click({ toggle: true, current: ['zz'], clicked: 'a' })).toEqual({ values: ['a', 'zz'], mode: 'toggle' });
    });
  });
});

describe('getSelectedIndices', () => {
  it('returns null without a selection', () => {
    expect(getSelectedIndices(categories, undefined)).toBeNull();
    expect(getSelectedIndices(categories, [])).toBeNull();
  });

  it('maps selected values to data indices, including repeated categories', () => {
    expect(getSelectedIndices(['a', 'b', 'a'], ['a'])).toEqual(new Set([0, 2]));
  });

  it('returns an empty set when no selected value is in the data', () => {
    expect(getSelectedIndices(categories, ['zz'])).toEqual(new Set());
  });
});
