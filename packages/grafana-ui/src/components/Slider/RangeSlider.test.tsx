import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { RangeSlider } from './RangeSlider';
import { type RangeSliderProps } from './types';

const sliderProps: RangeSliderProps = {
  min: 10,
  max: 20,
};

describe('RangeSlider', () => {
  it('updates controlled handle values when bounds are edited externally', () => {
    const { rerender } = render(
      <RangeSlider {...sliderProps} controlled value={[11, 18]} ariaLabelForHandle={['Minimum', 'Maximum']} />
    );
    expect(screen.getByRole('slider', { name: 'Minimum' })).toHaveAttribute('aria-valuenow', '11');
    rerender(<RangeSlider {...sliderProps} controlled value={[13, 17]} ariaLabelForHandle={['Minimum', 'Maximum']} />);
    expect(screen.getByRole('slider', { name: 'Minimum' })).toHaveAttribute('aria-valuenow', '13');
    expect(screen.getByRole('slider', { name: 'Maximum' })).toHaveAttribute('aria-valuenow', '17');
  });

  it('reports keyboard changes without moving a controlled handle until the owner updates it', async () => {
    const onChange = jest.fn();
    const user = userEvent.setup();
    render(
      <RangeSlider
        {...sliderProps}
        controlled
        value={[12, 18]}
        onChange={onChange}
        ariaLabelForHandle={['Minimum', 'Maximum']}
      />
    );
    await user.tab();
    // rc-slider reads legacy keyCode, which userEvent.keyboard does not populate.
    // eslint-disable-next-line testing-library/prefer-user-event
    fireEvent.keyDown(screen.getByRole('slider', { name: 'Minimum' }), { key: 'ArrowRight', keyCode: 39 });
    expect(onChange).toHaveBeenCalledWith([13, 18]);
    expect(screen.getByRole('slider', { name: 'Minimum' })).toHaveAttribute('aria-valuenow', '12');
  });

  it('preserves uncontrolled keyboard changes across prop rerenders', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <RangeSlider {...sliderProps} value={[12, 18]} ariaLabelForHandle={['Minimum', 'Maximum']} />
    );
    await user.tab();
    // rc-slider reads legacy keyCode, which userEvent.keyboard does not populate.
    // eslint-disable-next-line testing-library/prefer-user-event
    fireEvent.keyDown(screen.getByRole('slider', { name: 'Minimum' }), { key: 'ArrowRight', keyCode: 39 });
    rerender(<RangeSlider {...sliderProps} value={[11, 19]} ariaLabelForHandle={['Minimum', 'Maximum']} />);
    expect(screen.getByRole('slider', { name: 'Minimum' })).toHaveAttribute('aria-valuenow', '13');
  });
  it('renders without error', () => {
    expect(() => {
      render(<RangeSlider {...sliderProps} />);
    });
  });
});
