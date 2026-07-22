import { type ActionModel, type DisplayValue, type Field, FieldType, type LinkModel } from '@grafana/data';

import { getAlignmentFactor, getDataLinksActionsTooltipUtils, tooltipOnClickHandler } from './cellUtils';

function makeField(values: unknown[]): Field {
  return {
    name: 'test',
    type: FieldType.number,
    config: {},
    values,
    display: (v) => ({ text: String(v), numeric: Number(v) }),
    state: undefined,
  };
}

describe('getAlignmentFactor', () => {
  it('caches a new alignmentFactor on field.state when none exists', () => {
    const field = makeField([1, 2, 3]);
    const displayValue: DisplayValue = { text: '1', numeric: 1 };
    const result = getAlignmentFactor(field, displayValue, 0);
    expect(result).toMatchObject({ text: '1', numeric: 1 });
    expect(field.state?.alignmentFactors).toBe(result);
  });

  it('initializes field.state when the field has no state at all', () => {
    const field = makeField([42]);
    field.state = undefined;
    getAlignmentFactor(field, { text: '42', numeric: 42 }, 0);
    expect(field.state).toBeDefined();
    expect(field.state!.alignmentFactors).toBeDefined();
  });

  it('merges alignmentFactors into an existing state object without clobbering other state', () => {
    const field = makeField([1]);
    field.state = { calcs: { sum: 99 } };
    getAlignmentFactor(field, { text: '1', numeric: 1 }, 0);
    expect(field.state.alignmentFactors).toBeDefined();
    expect(field.state.calcs).toEqual({ sum: 99 });
  });

  it('returns the existing factor when the current value is not longer', () => {
    const field = makeField([1]);
    const cached = { text: 'long text' };
    field.state = { alignmentFactors: cached };
    const result = getAlignmentFactor(field, { text: 'x', numeric: 0 }, 0);
    expect(result).toBe(cached);
  });

  it('replaces the cached factor when the current display value is longer', () => {
    const field = makeField([1]);
    field.state = { alignmentFactors: { text: 'short' } };
    const longer: DisplayValue = { text: 'a much longer value here', numeric: 2 };
    const result = getAlignmentFactor(field, longer, 0);
    expect(result.text).toBe(longer.text);
    expect(field.state!.alignmentFactors!.text).toBe(longer.text);
  });
});

describe('getDataLinksActionsTooltipUtils', () => {
  it('returns shouldShowLink=true and hasMultipleLinksOrActions=false for exactly one link with no actions', () => {
    const { shouldShowLink, hasMultipleLinksOrActions } = getDataLinksActionsTooltipUtils([
      { href: '/foo' },
    ] as LinkModel[]);
    expect(shouldShowLink).toBe(true);
    expect(hasMultipleLinksOrActions).toBe(false);
  });

  it('returns shouldShowLink=false and hasMultipleLinksOrActions=true for multiple links', () => {
    const { shouldShowLink, hasMultipleLinksOrActions } = getDataLinksActionsTooltipUtils([
      { href: '/a' },
      { href: '/b' },
    ] as LinkModel[]);
    expect(shouldShowLink).toBe(false);
    expect(hasMultipleLinksOrActions).toBe(true);
  });

  it('returns shouldShowLink=false and hasMultipleLinksOrActions=true when actions are present alongside a single link', () => {
    const { shouldShowLink, hasMultipleLinksOrActions } = getDataLinksActionsTooltipUtils(
      [{ href: '/a' }] as LinkModel[],
      [{ title: 'act' }] as ActionModel[]
    );
    expect(shouldShowLink).toBe(false);
    expect(hasMultipleLinksOrActions).toBe(true);
  });

  it('returns hasMultipleLinksOrActions=true when there are actions but no links', () => {
    const { shouldShowLink, hasMultipleLinksOrActions } = getDataLinksActionsTooltipUtils(
      [] as LinkModel[],
      [{ title: 'act' }] as ActionModel[]
    );
    expect(shouldShowLink).toBe(false);
    expect(hasMultipleLinksOrActions).toBe(true);
  });

  it('returns both false for empty links and no actions', () => {
    const { shouldShowLink, hasMultipleLinksOrActions } = getDataLinksActionsTooltipUtils([] as LinkModel[]);
    expect(shouldShowLink).toBe(false);
    expect(hasMultipleLinksOrActions).toBe(false);
  });
});

describe('tooltipOnClickHandler', () => {
  function makeMouseEvent(target: EventTarget, currentTarget: EventTarget, clientX: number, clientY: number) {
    return { target, currentTarget, clientX, clientY } as unknown as React.MouseEvent<HTMLElement>;
  }

  it('calls setTooltipCoords with correct coordinates when clicking directly on the cell', () => {
    const setCoords = jest.fn();
    const handler = tooltipOnClickHandler(setCoords);
    const el = document.createElement('div');
    handler(makeMouseEvent(el, el, 100, 200));
    expect(setCoords).toHaveBeenCalledWith({ clientX: 100, clientY: 200 });
  });

  it('does not call setTooltipCoords when clicking on a child element', () => {
    const setCoords = jest.fn();
    const handler = tooltipOnClickHandler(setCoords);
    const parent = document.createElement('div');
    const child = document.createElement('span');
    handler(makeMouseEvent(child, parent, 50, 60));
    expect(setCoords).not.toHaveBeenCalled();
  });
});
