import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ColorValueEditor } from './color';

const setup = (value: string | undefined, settings = {}, details = false) => {
  const onChange = jest.fn();
  render(
    <ColorValueEditor value={value} onChange={onChange} settings={settings} details={details} id="color-editor" />
  );
  return { onChange };
};

describe('ColorValueEditor', () => {
  it('renders without crashing', () => {
    setup(undefined);
    // ColorPicker renders a swatch trigger
    expect(document.querySelector('button, [role="button"], div[class]')).toBeInTheDocument();
  });

  it('shows the color value text when details=true and value is set', () => {
    setup('red', {}, true);
    expect(screen.getByText('red')).toBeInTheDocument();
  });

  it('shows placeholder text when details=true and no value', () => {
    setup(undefined, { placeholder: 'Pick a color' }, true);
    expect(screen.getByText('Pick a color')).toBeInTheDocument();
  });

  it('shows default placeholder when details=true and no value or placeholder', () => {
    setup(undefined, {}, true);
    expect(screen.getByText('Select color')).toBeInTheDocument();
  });

  it('renders clear button when isClearable=true and value is set', () => {
    setup('blue', { isClearable: true }, true);
    expect(screen.getByRole('button', { name: /clear/i })).toBeInTheDocument();
  });

  it('calls onChange with undefined when clear button clicked', async () => {
    const { onChange } = setup('blue', { isClearable: true }, true);
    await userEvent.click(screen.getByRole('button', { name: /clear/i }));
    expect(onChange).toHaveBeenCalledWith(undefined);
  });
});
