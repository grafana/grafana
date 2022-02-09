import { getPosition } from './utils';

describe('utils', () => {
  it('getPosition', () => {
    const getElement = (right: number, width: number) =>
      ({
        parentElement: {
          getBoundingClientRect: () => ({ right }),
        },
        getBoundingClientRect: () => ({ width }),
      } as HTMLElement);

    Object.defineProperty(window, 'innerWidth', { value: 1000 });

    expect(getPosition(null)).toBe('left');
    expect(getPosition(getElement(900, 100))).toBe('right');
    expect(getPosition(getElement(800, 100))).toBe('left');
    expect(getPosition(getElement(1200, 0))).toBe('left');
  });
});
