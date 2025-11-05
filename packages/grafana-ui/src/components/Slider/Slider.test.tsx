import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Slider } from './Slider';
import { SliderProps } from './types';

import '@testing-library/jest-dom';

const sliderProps: SliderProps = {
  min: 10,
  max: 20,
  inputId: 'slider-test',
};

describe('Slider', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
  });

  it('respects min/max bounds after decimal input blur', async () => {
    render(<Slider {...sliderProps} min={0} max={10} value={5} />);

    const sliderInput = screen.getByRole('textbox');

    // Above max
    await user.clear(sliderInput);
    await user.type(sliderInput, '15.2');
    await user.click(document.body);
    expect(sliderInput).toHaveValue('10'); // max enforced

    // Below min
    await user.clear(sliderInput);
    await user.type(sliderInput, '-2.7');
    await user.click(document.body);
    expect(sliderInput).toHaveValue('0'); // min enforced
  });

  it('updates slider value correctly when decimal input is typed', async () => {
    render(<Slider {...sliderProps} min={0} max={10} step={0.2} value={5} />);

    const slider = screen.getByRole('slider');
    const sliderInput = screen.getByRole('textbox');

    await user.clear(sliderInput);
    await user.type(sliderInput, '7.3');
    await user.click(document.body);

    expect(slider).toHaveAttribute('aria-valuenow', '7.4');
  });

  it('renders without error', () => {
    expect(() => render(<Slider {...sliderProps} />)).not.toThrow();
  });

  it('renders correct contents', () => {
    render(<Slider {...sliderProps} />);

    const slider = screen.getByRole('slider');
    const sliderInput = screen.getByRole('textbox');

    expect(slider).toHaveAttribute('aria-valuemin', '10');
    expect(slider).toHaveAttribute('aria-valuemax', '20');
    expect(slider).toHaveAttribute('aria-valuenow', '10');
    expect(sliderInput).toHaveValue('10');
  });

  it('hides the slider input if showInput is false', () => {
    render(<Slider {...sliderProps} showInput={false} />);

    const slider = screen.getByRole('slider');
    const sliderInput = screen.queryByRole('textbox');

    expect(slider).toHaveAttribute('aria-valuemin', '10');
    expect(slider).toHaveAttribute('aria-valuemax', '20');
    expect(slider).toHaveAttribute('aria-valuenow', '10');
    expect(sliderInput).not.toBeInTheDocument();
  });

  it('renders correct contents with a value', () => {
    render(<Slider {...sliderProps} value={15} />);

    const slider = screen.getByRole('slider');
    const sliderInput = screen.getByRole('textbox');

    expect(slider).toHaveAttribute('aria-valuenow', '15');
    expect(sliderInput).toHaveValue('15');
  });

  it('allows for custom values to be set in the input', async () => {
    render(<Slider {...sliderProps} value={10} min={10} max={100} />);

    const slider = screen.getByRole('slider');
    const sliderInput = screen.getByRole('textbox');

    await user.clear(sliderInput);
    await user.type(sliderInput, '50');

    expect(slider).toHaveAttribute('aria-valuenow', '50');
    expect(sliderInput).toHaveValue('50');

    // click outside the input field to blur
    await user.click(document.body);

    expect(slider).toHaveAttribute('aria-valuenow', '50');
    expect(sliderInput).toHaveValue('50');
  });

  it('does not allow decimal numbers in input when step is integer', async () => {
    render(<Slider {...sliderProps} min={0} max={10} step={1} />);
    const sliderInput = screen.getByRole('textbox');
    const slider = screen.getByRole('slider');

    await user.clear(sliderInput);
    await user.type(sliderInput, '3.');

    expect(sliderInput).toHaveValue('3');

    await user.type(sliderInput, '5');

    expect(sliderInput).toHaveValue('35');

    // slider is clamped to min/max
    expect(slider).toHaveAttribute('aria-valuenow', '10');
  });

  it('allows decimal numbers in input when step is decimal', async () => {
    render(<Slider {...sliderProps} min={0} max={10} step={0.1} />);
    const sliderInput = screen.getByRole('textbox');
    const slider = screen.getByRole('slider');

    await user.clear(sliderInput);
    await user.type(sliderInput, '3.5');

    expect(sliderInput).toHaveValue('3.5');
    expect(slider).toHaveAttribute('aria-valuenow', '3.5');
  });

  it('does not allow non-numeric characters to be typed in the text input', async () => {
    render(<Slider {...sliderProps} min={-10} max={10} step={0.1} />);
    const sliderInput = screen.getByRole('textbox');
    const slider = screen.getByRole('slider');

    await user.clear(sliderInput);

    // the characters other than numbers and the first `-` and `.` are stripped as you type
    await user.type(sliderInput, 'ab-cd1ef.gh.1');

    expect(sliderInput).toHaveValue('-1.1');
    expect(slider).toHaveAttribute('aria-valuenow', '-1.1');
  });

  // this is because it's a bit confusing when the value is zeroed out and you click the input that you
  // can't type "-" immediately and it's an easy case to handle
  it('allows you to type "-" when the value is "0"', async () => {
    render(<Slider {...sliderProps} min={-10} max={10} step={0.1} />);
    const sliderInput = screen.getByRole('textbox');
    const slider = screen.getByRole('slider');

    await user.clear(sliderInput);

    // the zero is stripped
    await user.type(sliderInput, '0-1');

    expect(sliderInput).toHaveValue('-1');
    expect(slider).toHaveAttribute('aria-valuenow', '-1');
  });

  it('sets value to the closest available one after blur if input value is outside of range', async () => {
    render(<Slider {...sliderProps} value={10} min={10} max={100} />);

    const slider = screen.getByRole('slider');
    const sliderInput = screen.getByRole('textbox');

    // Check what happens above the maximum value
    await user.clear(sliderInput);
    await user.type(sliderInput, '200');
    expect(sliderInput).toHaveValue('200');
    expect(slider).toHaveAttribute('aria-valuenow', '100');
    await user.click(document.body); // click outside the input field to blur
    expect(sliderInput).toHaveValue('100');
    expect(slider).toHaveAttribute('aria-valuenow', '100');

    // Check what happens below the minimum value
    await user.clear(sliderInput);
    await user.type(sliderInput, '1');
    expect(sliderInput).toHaveValue('1');
    expect(slider).toHaveAttribute('aria-valuenow', '10');
    await user.click(document.body); // click outside the input field to blur
    expect(sliderInput).toHaveValue('10');
    expect(slider).toHaveAttribute('aria-valuenow', '10');
  });

  // the rest of the tests are uncontrolled already, don't need to separately test that
  it('can be a controlled input', async () => {
    const mockOnChange = jest.fn();
    const props: SliderProps = {
      ...sliderProps,
      onChange: mockOnChange,
      min: -10,
      max: 100,
    };

    const { rerender } = render(<Slider {...props} value={0} />);
    const slider = screen.getByRole('slider');
    const sliderInput = screen.getByRole('textbox');

    await user.type(sliderInput, '-1');
    // click outside the input field to blur
    await user.click(document.body);

    expect(slider).toHaveAttribute('aria-valuenow', '-1');
    expect(sliderInput).toHaveValue('-1');

    // Called once for each character of "-1" and once more on blur
    expect(mockOnChange).toHaveBeenCalledTimes(3);
    expect(mockOnChange).toHaveBeenCalledWith(-1);

    rerender(<Slider {...props} value={-1} />);

    rerender(<Slider {...props} value={45} />);

    // onChange should not be called when slider is re-rendered with a new value
    // this check ensure the state synchronization is working properly, since accidentally
    // causing onChange calls is a easy failure mode if that code is modified
    expect(mockOnChange).toHaveBeenCalledTimes(3);

    expect(slider).toHaveAttribute('aria-valuenow', '45');
    expect(sliderInput).toHaveValue('45');
  });
});
