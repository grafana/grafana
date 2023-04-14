/**
 * Returns whether the provided element overflows the viewport bounds
 *
 * @param element The element we want to know about
 */
export const isElementOverflowing = (element: HTMLElement | null) => {
  if (!element) {
    return false;
  }

  const wrapperPos = element.parentElement!.getBoundingClientRect();
  const pos = element.getBoundingClientRect();

  return pos.width !== 0 && wrapperPos.right + pos.width + 10 > window.innerWidth;
};
