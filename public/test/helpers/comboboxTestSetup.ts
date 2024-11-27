/**
 *  Needed for Combobox virtual list. The numbers are arbitrary and just need to be consistent.
 */
export const comboboxTestSetup = () => {
  const mockGetBoundingClientRect = jest.fn(() => ({
    width: 120,
    height: 120,
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
  }));

  Object.defineProperty(Element.prototype, 'getBoundingClientRect', {
    value: mockGetBoundingClientRect,
  });
};
