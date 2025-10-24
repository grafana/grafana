/**
 * Mock the getBoundingClientRect method for the HTMLElement prototype.
 * Useful when testing components such as combobox, or anything that relies on checking the size
 * of elements.
 */
export const mockGetBoundingClientRect = (overrides?: Partial<DOMRect>) => {
  window.HTMLElement.prototype.getBoundingClientRect = () => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return {
      height: 120,
      width: 120,
      bottom: 0,
      left: 0,
      right: 0,
      top: 0,
      x: 0,
      y: 0,
      ...overrides,
    } as DOMRect;
  };
};
