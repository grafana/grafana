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

/**
 * Mock `clientWidth`/`clientHeight`, which JSDOM always reports as 0.
 *
 * `mockBoundingClientRect` deliberately leaves these alone, since a component that branches on a zero
 * client size is often being tested for exactly that. Call this on top of it for libraries that size a
 * virtualized viewport from the client box - react-data-grid does, and without it renders no rows at all.
 */
export function mockClientSize({ width, height }: { width: number; height: number }): void {
  // On Element rather than HTMLElement, matching where JSDOM defines these - a definition on
  // HTMLElement.prototype would shadow, and silently defeat, a test's own narrower mock.
  Object.defineProperty(Element.prototype, 'clientWidth', {
    get: () => width,
    configurable: true,
  });
  Object.defineProperty(Element.prototype, 'clientHeight', {
    get: () => height,
    configurable: true,
  });
}

export function mockComboboxRect() {
  mockBoundingClientRect({ width: 120, height: 120 });
}
