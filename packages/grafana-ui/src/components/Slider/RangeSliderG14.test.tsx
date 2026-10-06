import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

import { RangeSliderG14 } from './RangeSliderG14';
import { type RangeSliderG14Props } from './types';

const sliderProps: RangeSliderG14Props = {
  min: 10,
  max: 20,
};

describe('RangeSliderG14', () => {
  it('updates controlled handle values when bounds are edited externally', () => {
    const { rerender } = render(
      <RangeSliderG14 {...sliderProps} value={[11, 18]} ariaLabelForHandle={['Minimum', 'Maximum']} />
    );
    expect(screen.getByRole('slider', { name: 'Minimum' })).toHaveAttribute('aria-valuenow', '11');
    rerender(<RangeSliderG14 {...sliderProps} value={[13, 17]} ariaLabelForHandle={['Minimum', 'Maximum']} />);
    expect(screen.getByRole('slider', { name: 'Minimum' })).toHaveAttribute('aria-valuenow', '13');
    expect(screen.getByRole('slider', { name: 'Maximum' })).toHaveAttribute('aria-valuenow', '17');
  });

  it('reports keyboard changes without moving a controlled handle until the owner updates it', async () => {
    const onChange = jest.fn();
    const user = userEvent.setup();
    render(
      <RangeSliderG14
        {...sliderProps}
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
      <RangeSliderG14 {...sliderProps} defaultValue={[12, 18]} ariaLabelForHandle={['Minimum', 'Maximum']} />
    );
    expect(screen.getByRole('slider', { name: 'Minimum' })).toHaveAttribute('aria-valuenow', '12');
    await user.tab();
    // rc-slider reads legacy keyCode, which userEvent.keyboard does not populate.
    // eslint-disable-next-line testing-library/prefer-user-event
    fireEvent.keyDown(screen.getByRole('slider', { name: 'Minimum' }), { key: 'ArrowRight', keyCode: 39 });
    rerender(<RangeSliderG14 {...sliderProps} defaultValue={[11, 19]} ariaLabelForHandle={['Minimum', 'Maximum']} />);
    expect(screen.getByRole('slider', { name: 'Minimum' })).toHaveAttribute('aria-valuenow', '13');
    expect(screen.getByRole('slider', { name: 'Maximum' })).toHaveAttribute('aria-valuenow', '18');
  });

  it('moves controlled handles when the parent accepts changes and reports completion', async () => {
    const onAfterChange = jest.fn();
    const user = userEvent.setup();
    function ControlledSlider() {
      const [value, setValue] = useState([12, 18]);
      return (
        <RangeSliderG14
          {...sliderProps}
          value={value}
          onChange={setValue}
          onAfterChange={onAfterChange}
          ariaLabelForHandle={['Minimum', 'Maximum']}
        />
      );
    }
    render(<ControlledSlider />);
    await user.tab();
    const handle = screen.getByRole('slider', { name: 'Minimum' });
    // rc-slider reads legacy keyCode, which userEvent.keyboard does not populate.
    // eslint-disable-next-line testing-library/prefer-user-event
    fireEvent.keyDown(handle, { key: 'ArrowRight', keyCode: 39 });
    expect(handle).toHaveAttribute('aria-valuenow', '13');
    expect(onAfterChange).not.toHaveBeenCalled();
    // eslint-disable-next-line testing-library/prefer-user-event
    fireEvent.keyUp(handle, { key: 'ArrowRight', keyCode: 39 });
    expect(onAfterChange).toHaveBeenCalledTimes(1);
    expect(onAfterChange).toHaveBeenCalledWith([13, 18]);
  });
});
