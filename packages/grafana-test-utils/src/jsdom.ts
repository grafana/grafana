/**
 * Mock `getBoundingClientRect` on `Element.prototype` so that layout-dependent
 * libraries (e.g. `@tanstack/react-virtual`) can measure containers in JSDOM.
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

  Object.defineProperty(Element.prototype, 'getBoundingClientRect', {
    value: () => ({ ...defaults, ...rect }),
    configurable: true,
  });
}
