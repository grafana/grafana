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

  it('should render selected values as pills', () => {
    setup({
      values: [{ value: 'job', label: 'job' }],
      options: [
        { value: 'job', label: 'job' },
        { value: 'instance', label: 'instance' },
      ],
    });
    expect(screen.getByText('job')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Remove' })).toHaveLength(1);
  });

  it('should show options in dropdown', async () => {
    const { user } = setup({
      options: [
        { label: 'job', value: 'job' },
        { label: 'instance', value: 'instance' },
      ],
    });
    const combobox = screen.getByRole('combobox');
    await user.click(combobox);

    expect(await screen.findByRole('option', { name: 'job' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'instance' })).toBeInTheDocument();
  });

  it('should call onChange when selecting an option', async () => {
    const onChange = jest.fn();
    const { user } = setup({
      options: [
        { label: 'job', value: 'job' },
        { label: 'instance', value: 'instance' },
      ],
      onChange,
    });
    const combobox = screen.getByRole('combobox');
    await user.click(combobox);
    await user.click(await screen.findByRole('option', { name: 'job' }));

    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ label: 'job', value: 'job' })]);
  });

  it('should call onChange when removing a value via pill', async () => {
    const onChange = jest.fn();
    const { user } = setup({
      values: [
        { value: 'job', label: 'job' },
        { value: 'instance', label: 'instance' },
      ],
      options: [
        { value: 'job', label: 'job' },
        { value: 'instance', label: 'instance' },
      ],
      onChange,
    });

    const removeButtons = screen.getAllByRole('button', { name: 'Remove' });
    await user.click(removeButtons[0]);

    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ label: 'instance', value: 'instance' })]);
  });
});
