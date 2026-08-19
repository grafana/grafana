/**
 * Scrolls an outline item's element to the top of the Explore scroller.
 *
 * Uses accumulated `offsetTop` up to the scroller rather than `getBoundingClientRect`
 * so the target lands at the same position regardless of the current scroll offset.
 */
export function scrollOutlineItemIntoView(
  scroller: HTMLElement | undefined,
  ref: HTMLElement | null,
  customOffsetTop = 0
) {
  let scrollValue = 0;
  let el: HTMLElement | null | undefined = ref;

  if (!el) {
    return;
  }

  do {
    scrollValue += el?.offsetTop || 0;
    el = el?.offsetParent instanceof HTMLElement ? el.offsetParent : undefined;
  } while (el && el !== scroller);

  scroller?.scroll({
    top: scrollValue + customOffsetTop,
    behavior: 'smooth',
  });
}
