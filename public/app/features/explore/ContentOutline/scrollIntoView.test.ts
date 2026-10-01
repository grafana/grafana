import { scrollOutlineItemIntoView } from './scrollIntoView';

/**
 * jsdom reports every rect as zero and never lays elements out, so the geometry the helper
 * reads has to be stated here.
 */
const elementAt = (top: number) => {
  const el = document.createElement('div');
  el.getBoundingClientRect = () => ({ top }) as DOMRect;
  return el;
};

const scrollerAt = (top: number, scrollTop: number) => {
  const scroller = elementAt(top);
  Object.defineProperty(scroller, 'scrollTop', { value: scrollTop });
  scroller.scroll = jest.fn();
  return scroller;
};

describe('scrollOutlineItemIntoView', () => {
  // The scroller sits 100px down the page, so a target measured from the viewport instead of from
  // the scroller would land 100px off. The same item is given at two scroll offsets, because its
  // rect moves with the scroll while the position it should be scrolled to does not.
  it.each([
    { desc: 'barely scrolled', scrollTop: 50, itemTop: 300 },
    { desc: 'scrolled past the item', scrollTop: 400, itemTop: -50 },
  ])('scrolls the item to the top of a scroller that is $desc', ({ scrollTop, itemTop }) => {
    const scroller = scrollerAt(100, scrollTop);

    scrollOutlineItemIntoView(scroller, elementAt(itemTop));

    expect(scroller.scroll).toHaveBeenCalledWith({ top: 250, behavior: 'smooth' });
  });

  it('shifts the target up by the item custom offset, so a query row clears the header above it', () => {
    const scroller = scrollerAt(100, 50);

    scrollOutlineItemIntoView(scroller, elementAt(300), -10);

    expect(scroller.scroll).toHaveBeenCalledWith({ top: 240, behavior: 'smooth' });
  });

  it('does not scroll for an item that registered without a ref', () => {
    const scroller = scrollerAt(100, 50);

    scrollOutlineItemIntoView(scroller, null);

    expect(scroller.scroll).not.toHaveBeenCalled();
  });
});
