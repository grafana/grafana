import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { useSplitter, type UseSplitterOptions } from './useSplitter';

interface TestProps extends UseSplitterOptions {
  primaryWidth: number;
  containerWidth: number;
}

/**
 * jsdom has no layout, so every getBoundingClientRect is 0. The hook reads widths from the DOM to
 * decide how far a drag may go, so each pane is stubbed with the width the test needs.
 */
function TestSplitter({ primaryWidth, containerWidth, ...options }: TestProps) {
  const { containerProps, primaryProps, secondaryProps, splitterProps } = useSplitter(options);

  const stubWidth = (width: number) => (el: HTMLDivElement | null) => {
    if (el) {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      el.getBoundingClientRect = () =>
        ({
          width,
          height: 100,
          top: 0,
          left: 0,
          right: width,
          bottom: 100,
          x: 0,
          y: 0,
        }) as DOMRect;
    }
  };

  return (
    <div
      {...containerProps}
      ref={(el) => {
        stubWidth(containerWidth)(el);
        containerProps.ref.current = el;
      }}
    >
      <div
        {...primaryProps}
        ref={(el) => {
          stubWidth(primaryWidth)(el);
          primaryProps.ref.current = el;
        }}
      />
      <div {...splitterProps} />
      <div
        {...secondaryProps}
        ref={(el) => {
          stubWidth(containerWidth - primaryWidth)(el);
          secondaryProps.ref.current = el;
        }}
      />
    </div>
  );
}

async function dragSplitterBy(pixels: number) {
  const splitter = screen.getByRole('separator');
  splitter.setPointerCapture = jest.fn();
  splitter.releasePointerCapture = jest.fn();

  await userEvent.pointer([
    { keys: '[MouseLeft>]', target: splitter, coords: { clientX: 0, clientY: 0 } },
    { target: splitter, coords: { clientX: pixels, clientY: 0 } },
  ]);
}

describe('useSplitter', () => {
  it('keeps responding to drags when the primary pane has been collapsed to zero', async () => {
    const onResizing = jest.fn();

    render(<TestSplitter direction="row" primaryWidth={0} containerWidth={1000} onResizing={onResizing} />);

    await dragSplitterBy(200);

    expect(onResizing).toHaveBeenCalled();
  });

  it('responds to drags at a normal size', async () => {
    const onResizing = jest.fn();

    render(<TestSplitter direction="row" primaryWidth={400} containerWidth={1000} onResizing={onResizing} />);

    await dragSplitterBy(50);

    expect(onResizing).toHaveBeenCalled();
  });
});
