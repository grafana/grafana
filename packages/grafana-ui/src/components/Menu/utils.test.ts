import { isElementOverflowing } from './utils';

describe('utils', () => {
  it('isElementOverflowing', () => {
    const getElement = (right: number, width: number) =>
      ({
        parentElement: {
          getBoundingClientRect: () => ({ right }),
        },
        getBoundingClientRect: () => ({ width }),
      } as HTMLElement);

    Object.defineProperty(window, 'innerWidth', { value: 1000 });

    expect(isElementOverflowing(null)).toBe(false);
    expect(isElementOverflowing(getElement(900, 100))).toBe(true);
    expect(isElementOverflowing(getElement(800, 100))).toBe(false);
    expect(isElementOverflowing(getElement(1200, 0))).toBe(false);
  });
});
