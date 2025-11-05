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

  it('allows decimal numbers in input', async () => {
    render(<Slider {...sliderProps} min={0} max={10} step={0.1} />);
    const sliderInput = screen.getByRole('textbox');
    const slider = screen.getByRole('slider');

    await user.clear(sliderInput);
    await user.type(sliderInput, '3.5');

    expect(sliderInput).toHaveValue('3.5');
    expect(slider).toHaveAttribute('aria-valuenow', '3.5');
  });

  it('respects min/max bounds after decimal input blur', async () => {
    render(<Slider min={0} max={10} value={5} />);

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
    render(<Slider min={0} max={10} step={0.1} value={5} />);

    const slider = screen.getByRole('slider');
    const sliderInput = screen.getByRole('textbox');

    await user.clear(sliderInput);
    await user.type(sliderInput, '7.3');
    await user.click(document.body);

    expect(slider).toHaveAttribute('aria-valuenow', '7.3');
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
});
