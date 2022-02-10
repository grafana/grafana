/**
 * Returns where the subMenu should be positioned (left or right)
 *
 * @param element HTMLElement for the subMenu wrapper
 */
export const getPosition = (element: HTMLElement | null) => {
  if (!element) {
    return 'left';
  }

  const wrapperPos = element.parentElement!.getBoundingClientRect();
  const pos = element.getBoundingClientRect();

  if (pos.width === 0) {
    return 'left';
  }

  if (wrapperPos.right + pos.width + 10 > window.innerWidth) {
    return 'right';
  } else {
    return 'left';
  }
};
