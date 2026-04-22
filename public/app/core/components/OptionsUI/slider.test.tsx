import { render, screen } from '@testing-library/react';

import { SliderValueEditor } from './slider';

const defaultItem = {
  id: 'slider',
  name: 'Slider',
  description: '',
  settings: { min: 0, max: 100, step: 1 },
  editor: () => null,
  override: () => null,
  process: (v: unknown) => v,
  shouldApply: () => true,
};

const setup = (value: number, settings = defaultItem.settings) => {
  const onChange = jest.fn();
  render(
    <SliderValueEditor
      value={value}
      onChange={onChange}
      item={{ ...defaultItem, settings }}
      context={{ data: [] }}
      id="slider-editor"
    />
  );
  return { onChange };
};

describe('SliderValueEditor', () => {
  it('renders without crashing', () => {
    setup(50);
    expect(screen.getByRole('spinbutton')).toBeInTheDocument();
  });

  it('renders the number input with the current value', () => {
    setup(42);
    expect(screen.getByDisplayValue('42')).toBeInTheDocument();
  });

  it('renders with custom min and max', () => {
    setup(5, { min: 1, max: 10, step: 1 });
    const input = screen.getByRole('spinbutton');
    expect(input).toHaveAttribute('min', '1');
    expect(input).toHaveAttribute('max', '10');
  });
});
