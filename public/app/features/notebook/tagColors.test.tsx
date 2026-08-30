import { render, screen } from 'test/test-utils';

import { createTheme } from '@grafana/data';
import { TagList } from '@grafana/ui';

import { getNeutralTagListStyle } from './tagColors';

function renderList(tags: string[], { neutral, displayMax }: { neutral: boolean; displayMax?: number }) {
  const { unmount } = render(
    <TagList
      tags={tags}
      displayMax={displayMax}
      className={neutral ? getNeutralTagListStyle(createTheme()) : undefined}
    />
  );
  const overflow = screen.getByText(/^\+/);
  const { backgroundColor, color } = getComputedStyle(overflow);
  const shown = document.querySelectorAll('[data-tag-id]').length;
  unmount();
  return { backgroundColor, color, shown };
}

describe('getNeutralTagListStyle', () => {
  /**
   * Compared against the same list rendered without the style rather than against literal colours, so
   * what is asserted is the thing that matters: the rule is for the tags, and the overflow count that
   * TagList renders beside them once displayMax is set should come out exactly as it would untouched.
   *
   * It did not, before: the rule matched every descendant span, and that label is one, so a count
   * meant to read as muted text was given a chip's background and the primary text colour.
   */
  it('leaves the overflow count exactly as TagList renders it', () => {
    const plain = renderList(['a', 'b', 'c', 'd'], { neutral: false, displayMax: 3 });
    const neutral = renderList(['a', 'b', 'c', 'd'], { neutral: true, displayMax: 3 });

    expect(neutral.backgroundColor).toBe(plain.backgroundColor);
    expect(neutral.color).toBe(plain.color);
    // Guards the comparison itself: it would also hold if the style stopped reaching the list at all.
    expect(neutral.shown).toBe(3);
  });

  // A Tag renders a button rather than a span once it can be clicked, so an element-name rule would
  // have quietly stopped colouring these lists the day one of them became clickable. Pins the
  // TagList contract the attribute selector relies on rather than the styling itself.
  it('marks the tags whether or not the list is clickable', () => {
    render(<TagList tags={['latency']} onClick={jest.fn()} className={getNeutralTagListStyle(createTheme())} />);

    expect(document.querySelector('[data-tag-id]')?.tagName).toBe('BUTTON');
  });
});
