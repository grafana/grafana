import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DefaultValueEditor, DefaultValueEditorProps } from './DefaultValueEditor';

describe('DefaultValueEditor', () => {
  const defaultProps: DefaultValueEditorProps = {
    values: [],
    options: [],
    onChange: jest.fn(),
  };

  beforeAll(() => {
    Object.defineProperty(Element.prototype, 'getBoundingClientRect', {
      value: jest.fn(() => ({
        width: 200,
        height: 200,
        x: 0,
        y: 0,
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
      })),
    });
  });

  function setup(overrides?: Partial<DefaultValueEditorProps>) {
    const props = { ...defaultProps, ...overrides, onChange: overrides?.onChange ?? jest.fn() };
    return {
      renderer: render(<DefaultValueEditor {...props} />),
      user: userEvent.setup(),
      onChange: props.onChange,
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render a row for each value', () => {
    setup({ values: ['foo', 'bar', 'baz'] });
    expect(screen.getAllByRole('button', { name: 'Remove default value' })).toHaveLength(3);
    expect(screen.getAllByRole('combobox')).toHaveLength(3);
  });

  it('should call onChange with the value removed when remove is clicked', async () => {
    const onChange = jest.fn();
    const { user } = setup({ values: ['a', 'b', 'c'], onChange });
    const removeButtons = screen.getAllByRole('button', { name: 'Remove default value' });
    await user.click(removeButtons[1]);
    expect(onChange).toHaveBeenCalledWith(['a', 'c']);
  });

  it('should call onChange with updated value when a combobox option is selected', async () => {
    const onChange = jest.fn();
    const { user } = setup({
      values: [''],
      options: [
        { label: 'job', value: 'job' },
        { label: 'instance', value: 'instance' },
      ],
      onChange,
    });
    const combobox = screen.getByRole('combobox');
    await user.click(combobox);
    await user.click(screen.getByRole('option', { name: 'job' }));
    expect(onChange).toHaveBeenCalledWith(['job']);
  });

  it('should call onChange with updated value when a custom value is typed', async () => {
    const onChange = jest.fn();
    const { user } = setup({
      values: [''],
      options: [],
      onChange,
    });
    const combobox = screen.getByRole('combobox');
    await user.type(combobox, 'custom-val');
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledWith(['custom-val']);
  });
});
