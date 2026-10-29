import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { RangeSlider } from './RangeSlider';

describe('RangeSlider', () => {
  it.each([
    { name: 'legacy value', initial: { value: [12, 18] }, updated: { value: [11, 19] } },
    { name: 'defaultValue', initial: { defaultValue: [12, 18] }, updated: { defaultValue: [11, 19] } },
    {
      name: 'defaultValue over legacy value',
      initial: { defaultValue: [12, 18], value: [11, 19] },
      updated: { defaultValue: [11, 19], value: [14, 16] },
    },
  ])('initializes from $name and preserves user changes across prop updates', async ({ initial, updated }) => {
    const onChange = jest.fn();
    const onAfterChange = jest.fn();
    const user = userEvent.setup();
    const props = {
      min: 10,
      max: 20,
      onChange,
      onAfterChange,
      ariaLabelForHandle: ['Minimum', 'Maximum'],
    };
    const { rerender } = render(<RangeSlider {...props} {...initial} />);
    const minimum = screen.getByRole('slider', { name: 'Minimum' });
    expect(minimum).toHaveAttribute('aria-valuenow', '12');
    expect(screen.getByRole('slider', { name: 'Maximum' })).toHaveAttribute('aria-valuenow', '18');
    await user.tab();
    // rc-slider reads legacy keyCode, which userEvent.keyboard does not populate.
    // eslint-disable-next-line testing-library/prefer-user-event
    fireEvent.keyDown(minimum, { key: 'ArrowRight', keyCode: 39 });
    expect(minimum).toHaveAttribute('aria-valuenow', '13');
    expect(onChange).toHaveBeenCalledWith([13, 18]);
    expect(onAfterChange).not.toHaveBeenCalled();
    // eslint-disable-next-line testing-library/prefer-user-event
    fireEvent.keyUp(minimum, { key: 'ArrowRight', keyCode: 39 });
    expect(onAfterChange).toHaveBeenCalledTimes(1);
    expect(onAfterChange).toHaveBeenCalledWith([13, 18]);
    rerender(<RangeSlider {...props} {...updated} />);
    expect(minimum).toHaveAttribute('aria-valuenow', '13');
    expect(screen.getByRole('slider', { name: 'Maximum' })).toHaveAttribute('aria-valuenow', '18');
  });
});
