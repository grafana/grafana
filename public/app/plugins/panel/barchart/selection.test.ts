import { applySelectionClick, getSelectedIndices, type SelectionClickInput } from './selection';

const categories = ['a', 'b', 'c', 'd', 'e'];

function click(overrides: Partial<SelectionClickInput>) {
  return applySelectionClick({
    categories,
    current: undefined,
    anchor: null,
    clicked: 'a',
    meta: false,
    shift: false,
    ...overrides,
  });
}

describe('applySelectionClick', () => {
  describe('plain click', () => {
    it('replaces the selection and moves the anchor', () => {
      expect(click({ current: ['a', 'b'], anchor: 'a', clicked: 'd' })).toEqual({
        values: ['d'],
        mode: 'replace',
        anchor: 'd',
      });
    });

    it('clears the selection when clicking the sole selected value', () => {
      expect(click({ current: ['c'], anchor: 'c', clicked: 'c' })).toEqual({
        values: [],
        mode: 'replace',
        anchor: 'c',
      });
    });

    it('takes ownership with the clicked value when the panel owns no selection', () => {
      expect(click({ current: undefined, clicked: 'c' })).toEqual({ values: ['c'], mode: 'replace', anchor: 'c' });
    });

    it('selects only the clicked value when it is one of several selected', () => {
      expect(click({ current: ['b', 'c'], clicked: 'c' }).values).toEqual(['c']);
    });
  });

  describe('Ctrl/Cmd-click', () => {
    it('adds an unselected value in display order and moves the anchor', () => {
      expect(click({ current: ['d'], anchor: 'd', clicked: 'b', meta: true })).toEqual({
        values: ['b', 'd'],
        mode: 'toggle',
        anchor: 'b',
      });
    });

    it('removes a selected value', () => {
      expect(click({ current: ['b', 'd'], clicked: 'd', meta: true }).values).toEqual(['b']);
    });

    it('clears when removing the last value', () => {
      expect(click({ current: ['b'], clicked: 'b', meta: true }).values).toEqual([]);
    });

    it('starts from an empty selection when the panel owns none', () => {
      expect(click({ current: undefined, clicked: 'e', meta: true }).values).toEqual(['e']);
    });
  });

  describe('Shift-click', () => {
    it('adds every category from the anchor to the clicked value, inclusive, keeping the anchor', () => {
      expect(click({ current: ['b'], anchor: 'b', clicked: 'd', shift: true })).toEqual({
        values: ['b', 'c', 'd'],
        mode: 'range',
        anchor: 'b',
      });
    });

    it('works backwards from the anchor and keeps values outside the range', () => {
      expect(click({ current: ['e', 'c'], anchor: 'c', clicked: 'a', shift: true }).values).toEqual([
        'a',
        'b',
        'c',
        'e',
      ]);
    });

    it('adds the clicked value and anchors there when the anchor is no longer a category', () => {
      expect(click({ current: ['b'], anchor: 'gone', clicked: 'd', shift: true })).toEqual({
        values: ['b', 'd'],
        mode: 'range',
        anchor: 'd',
      });
    });

    it('takes precedence over Ctrl/Cmd', () => {
      expect(click({ current: ['a'], anchor: 'a', clicked: 'c', shift: true, meta: true }).mode).toBe('range');
    });
  });

  it('keeps selected values that are missing from the data after the ordered ones', () => {
    expect(click({ current: ['zz', 'b'], clicked: 'a', meta: true }).values).toEqual(['a', 'b', 'zz']);
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
