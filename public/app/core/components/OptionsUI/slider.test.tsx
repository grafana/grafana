import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { SliderValueEditor } from './slider';

describe('SliderValueEditor', () => {
  it('renders a slider and number input', () => {
    const onChange = jest.fn();
    render(
      <SliderValueEditor
        value={10}
        onChange={onChange}
        item={{ settings: { min: 0, max: 20 } } as Parameters<typeof SliderValueEditor>[0]['item']}
        context={{ data: [] }}
        id="slider-1"
      />
    );

    expect(screen.getByRole('slider')).toBeInTheDocument();

    const input = screen.getByRole('textbox');
    expect(input).toHaveDisplayValue('10');
  });

  it('fires onChange when the numeric input loses focus with a new value', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();

    render(
      <SliderValueEditor
        value={5}
        onChange={onChange}
        item={{ settings: { min: 0, max: 100 } } as Parameters<typeof SliderValueEditor>[0]['item']}
        context={{ data: [] }}
        id="slider-2"
      />
    );

    const input = screen.getByRole('textbox');
    await user.clear(input);
    await user.type(input, '42');
    fireEvent.blur(input);

    expect(onChange).toHaveBeenCalledWith(42);
  });
});
