import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { StringValueEditor } from './string';

const defaultItem = {
  id: 'text',
  name: 'Text',
  description: '',
  settings: {},
  editor: () => null,
  override: () => null,
  process: (v: unknown) => v,
  shouldApply: () => true,
};

const setup = (value: string | undefined, settings = {}) => {
  const onChange = jest.fn();
  render(
    <StringValueEditor
      value={value}
      onChange={onChange}
      item={{ ...defaultItem, settings }}
      context={{ data: [] }}
      id="string-editor"
    />
  );
  return { onChange };
};

describe('StringValueEditor', () => {
  it('renders an input by default', () => {
    setup('hello');
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('renders a textarea when useTextarea is true', () => {
    setup('hello', { useTextarea: true });
    expect(screen.getByRole('textbox').tagName).toBe('TEXTAREA');
  });

  it('calls onChange with trimmed value on blur', () => {
    const { onChange } = setup('');
    const input = screen.getByRole('textbox');
    fireEvent.blur(input, { target: { value: '  new value  ' } });
    expect(onChange).toHaveBeenCalledWith('new value');
  });

  it('calls onChange with undefined when value is cleared', () => {
    const { onChange } = setup('existing');
    const input = screen.getByRole('textbox');
    fireEvent.blur(input, { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it('calls onChange on Enter key press', async () => {
    const { onChange } = setup('');
    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'typed{Enter}');
    expect(onChange).toHaveBeenCalledWith('typed');
  });

  it('does not call onChange when value is unchanged on blur', () => {
    const { onChange } = setup('same');
    const input = screen.getByRole('textbox');
    fireEvent.blur(input, { target: { value: 'same' } });
    expect(onChange).not.toHaveBeenCalled();
  });
});
