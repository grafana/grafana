import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { StringArrayEditor } from './strings';

const defaultItem = {
  id: 'strings',
  name: 'String array',
  description: '',
  settings: {},
  editor: () => null,
  override: () => null,
  process: (v: unknown) => v,
  shouldApply: () => true,
};

const setup = (value: string[] = [], settings = {}) => {
  const onChange = jest.fn();
  render(
    <StringArrayEditor value={value} onChange={onChange} item={{ ...defaultItem, settings }} context={{ data: [] }} />
  );
  return { onChange };
};

describe('StringArrayEditor', () => {
  it('renders without crashing', () => {
    setup();
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('renders existing values as inputs', () => {
    setup(['foo', 'bar']);
    expect(screen.getByDisplayValue('foo')).toBeInTheDocument();
    expect(screen.getByDisplayValue('bar')).toBeInTheDocument();
  });

  it('shows add input when Add button is clicked', async () => {
    setup([]);
    await userEvent.click(screen.getByRole('button'));
    expect(screen.getByPlaceholderText('Add text')).toBeInTheDocument();
  });

  it('adds a new value on Enter', async () => {
    const { onChange } = setup([]);
    await userEvent.click(screen.getByRole('button'));
    const input = screen.getByPlaceholderText('Add text');
    await userEvent.type(input, 'newval{Enter}');
    expect(onChange).toHaveBeenCalledWith(['newval']);
  });

  it('removes a value when trash icon is clicked', async () => {
    const { onChange } = setup(['foo', 'bar']);
    const trashIcons = screen.getAllByTestId('icon-trash-alt');
    // first trash icon corresponds to 'foo'
    await userEvent.click(trashIcons[0]);
    expect(onChange).toHaveBeenCalledWith(['bar']);
  });

  it('updates a value on blur', () => {
    const { onChange } = setup(['original']);
    const input = screen.getByDisplayValue('original');
    fireEvent.blur(input, { target: { value: 'updated' } });
    expect(onChange).toHaveBeenCalledWith(['updated']);
  });

  it('removes a value when input is cleared on blur', () => {
    const { onChange } = setup(['to-remove']);
    const input = screen.getByDisplayValue('to-remove');
    fireEvent.blur(input, { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith([]);
  });
});
