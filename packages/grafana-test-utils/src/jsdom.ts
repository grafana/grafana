/**
 * Mock element dimensions so that layout-dependent libraries
 * (e.g. `@tanstack/react-virtual`) can measure containers in JSDOM.
 *
 * Call this in a `beforeAll` block in test files that render virtualized lists.
 */
export function mockBoundingClientRect(rect: Partial<DOMRect> = {}): void {
  const defaults: DOMRect = {
    width: 400,
    height: 400,
    top: 0,
    left: 0,
    bottom: 400,
    right: 400,
    x: 0,
    y: 0,
    toJSON: () => {},
  };

  const merged = { ...defaults, ...rect };

  Object.defineProperty(Element.prototype, 'getBoundingClientRect', {
    value: () => merged,
    configurable: true,
  });

  // @tanstack/react-virtual >=3.11 reads offsetWidth/offsetHeight directly
  // (not getBoundingClientRect) to size the scroll container and items.
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    get: () => merged.width,
    configurable: true,
  });
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    get: () => merged.height,
    configurable: true,
  });
}

export function mockComboboxRect() {
  mockBoundingClientRect({ width: 120, height: 120 });
}
