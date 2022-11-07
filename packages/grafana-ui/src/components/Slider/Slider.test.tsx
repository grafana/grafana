import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { Slider } from './Slider';
import { SliderProps } from './types';

const sliderProps: SliderProps = {
  min: 10,
  max: 20,
};

describe('Slider', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
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
