/**
 * Scrolls an outline item's element to the top of the Explore scroller.
 *
 * Walking `offsetTop` up the `offsetParent` chain overshoots: the scroller is unpositioned, so it
 * never appears in that chain and ancestors above it get added.
 */
export function scrollOutlineItemIntoView(
  scroller: HTMLElement | undefined,
  ref: HTMLElement | null,
  customOffsetTop = 0
) {
  if (!scroller || !ref) {
    return;
  }

  const scrollValue = scroller.scrollTop + ref.getBoundingClientRect().top - scroller.getBoundingClientRect().top;

  scroller.scroll({
    top: scrollValue + customOffsetTop,
    behavior: 'smooth',
  });
}
