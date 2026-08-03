import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';

import { ColumnFreezeDivider } from './ColumnFreezeDivider';

function rect(left: number, right: number): DOMRect {
  return {
    x: left,
    y: 0,
    left,
    right,
    top: 0,
    bottom: 100,
    width: right - left,
    height: 100,
    toJSON: () => ({}),
  };
}

function setup(onPinnedColumnCountChange = jest.fn()) {
  const gridRef = createRef<HTMLDivElement>();
  render(
    <div ref={gridRef}>
      <div className="rdg-header-row">
        <div role="columnheader">A</div>
        <div role="columnheader">B</div>
        <div role="columnheader">C</div>
      </div>
      <ColumnFreezeDivider
        gridRef={gridRef}
        columnCount={3}
        pinnedColumnCount={1}
        pinnedWidth={100}
        onPinnedColumnCountChange={onPinnedColumnCountChange}
      />
    </div>
  );

  jest.spyOn(gridRef.current!, 'getBoundingClientRect').mockReturnValue(rect(0, 300));
  const cells = screen.getAllByRole('columnheader');
  cells.forEach((cell, index) => {
    jest.spyOn(cell, 'getBoundingClientRect').mockReturnValue(rect(index * 100, (index + 1) * 100));
  });

  const divider = screen.getByRole('slider', { name: 'Pinned column boundary' });
  divider.setPointerCapture = jest.fn();
  divider.releasePointerCapture = jest.fn();

  return { divider, onPinnedColumnCountChange };
}

describe('ColumnFreezeDivider', () => {
  it('changes the boundary with the keyboard', async () => {
    const user = userEvent.setup();
    const { divider, onPinnedColumnCountChange } = setup();

    divider.focus();
    await user.keyboard('{ArrowRight}{Home}{End}');

    expect(onPinnedColumnCountChange).toHaveBeenNthCalledWith(1, 2);
    expect(onPinnedColumnCountChange).toHaveBeenNthCalledWith(2, 0);
    expect(onPinnedColumnCountChange).toHaveBeenNthCalledWith(3, 3);
  });

  it('selects the nearest column boundary while dragging', () => {
    const { divider, onPinnedColumnCountChange } = setup();

    fireEvent(divider, pointerEvent('pointerdown', 100));
    fireEvent(divider, pointerEvent('pointermove', 180));
    expect(divider).toHaveAttribute('aria-valuenow', '2');

    fireEvent(divider, pointerEvent('pointerup', 180));
    expect(onPinnedColumnCountChange).toHaveBeenCalledWith(2);
  });
});

function pointerEvent(type: string, clientX: number): Event {
  const event = new Event(type, { bubbles: true });
  Object.defineProperties(event, {
    clientX: { value: clientX },
    pointerId: { value: 1 },
  });
  return event;
}
