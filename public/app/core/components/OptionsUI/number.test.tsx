import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { NumberValueEditor } from './number';

const defaultItem = {
  id: 'number',
  name: 'Number',
  description: '',
  settings: {},
  editor: () => null,
  override: () => null,
  process: (v: unknown) => v,
  shouldApply: () => true,
};

const setup = (value: number | undefined, settings = {}) => {
  const onChange = jest.fn();
  render(
    <NumberValueEditor
      value={value}
      onChange={onChange}
      item={{ ...defaultItem, settings }}
      context={{ data: [] }}
      id="number-editor"
    />
  );
  return { onChange };
};

describe('NumberValueEditor', () => {
  it('renders an input with the provided value', () => {
    setup(42);
    expect(screen.getByDisplayValue('42')).toBeInTheDocument();
  });

  it('calls onChange with the numeric value on blur', async () => {
    const { onChange } = setup(10);
    const input = screen.getByRole('spinbutton');
    await userEvent.clear(input);
    await userEvent.type(input, '99');
    await userEvent.tab();
    expect(onChange).toHaveBeenCalledWith(99);
  });

  it('floors value when integer setting is true', async () => {
    const { onChange } = setup(1, { integer: true });
    const input = screen.getByRole('spinbutton');
    await userEvent.clear(input);
    await userEvent.type(input, '3.7');
    await userEvent.tab();
    expect(onChange).toHaveBeenCalledWith(3);
  });

  it('passes undefined when cleared', async () => {
    const { onChange } = setup(5);
    const input = screen.getByRole('spinbutton');
    await userEvent.clear(input);
    await userEvent.tab();
    expect(onChange).toHaveBeenCalledWith(undefined);
  });
});
