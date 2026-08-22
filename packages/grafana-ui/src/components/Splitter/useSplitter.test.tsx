import { fireEvent, render, screen } from '@testing-library/react';

import { useSplitter, type UseSplitterOptions } from './useSplitter';

function Splitter(options: UseSplitterOptions) {
  const { containerProps, primaryProps, secondaryProps, splitterProps } = useSplitter(options);

  return (
    <div {...containerProps}>
      <div {...primaryProps} />
      <div {...splitterProps} />
      <div {...secondaryProps} />
    </div>
  );
}

describe('useSplitter', () => {
  const CONTAINER = 1000;
  const HANDLE = 16;

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // A pane can legitimately settle at zero. Starting the next gesture from that position must
  // treat zero as a measured size, not as an uninitialized ref, or the divider gets stuck.
  it('grows a zero-size primary pane on a new drag', () => {
    const onResizing = jest.fn();
    const { container } = render(<Splitter direction="column" initialSize={0} onResizing={onResizing} />);
    const splitterContainer = container.firstElementChild!;
    const primaryPane = splitterContainer.firstElementChild as HTMLElement;
    const separator = screen.getByRole('separator');
    separator.setPointerCapture = jest.fn();

    // jsdom has no layout. The primary pane starts at zero, but can grow to fill the space when
    // measureElement probes its maximum size during pointerdown.
    jest.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      const height =
        this === splitterContainer
          ? CONTAINER
          : this === primaryPane && primaryPane.style.flexGrow === '100'
            ? CONTAINER - HANDLE
            : 0;
      return { width: 0, height } as DOMRect;
    });

    // jsdom does not implement PointerEvent, so dispatch mouse-shaped events under pointer names;
    // React's pointer handlers still receive the coordinates used by the hook.
    fireEvent(separator, new MouseEvent('pointerdown', { bubbles: true, clientY: 0 }));
    fireEvent(separator, new MouseEvent('pointermove', { bubbles: true, clientY: 200 }));

    expect(onResizing).toHaveBeenCalledWith(200 / (CONTAINER - HANDLE), 200, CONTAINER - HANDLE - 200);
    expect(primaryPane).toHaveStyle({ flexGrow: `${200 / (CONTAINER - HANDLE)}` });
  });
});
