import { getScrollLeftToReveal } from './utils';

describe('getScrollLeftToReveal', () => {
  const view = { left: 0, right: 500 };

  it('keeps the scroll position when the target is already visible', () => {
    expect(getScrollLeftToReveal(120, { left: 100, right: 300 }, view, 32)).toBe(120);
  });

  it('scrolls a target hidden on the right so it starts after the context gap', () => {
    expect(getScrollLeftToReveal(0, { left: 800, right: 1000 }, view, 32)).toBe(768);
  });

  it('scrolls a target hidden on the left back into view', () => {
    expect(getScrollLeftToReveal(900, { left: -300, right: -100 }, view, 32)).toBe(568);
  });

  it('aligns the end of a target wider than the view, so the function name stays visible', () => {
    expect(getScrollLeftToReveal(0, { left: 800, right: 1600 }, view, 32)).toBe(1100);
  });

  it('never scrolls past the start', () => {
    expect(getScrollLeftToReveal(10, { left: -20, right: 100 }, view, 32)).toBe(0);
  });
});
