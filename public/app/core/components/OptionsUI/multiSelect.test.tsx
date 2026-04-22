import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { MultiSelectValueEditor } from './multiSelect';

const defaultItem = {
  id: 'multi-select',
  name: 'Multi select',
  description: '',
  settings: {
    options: [
      { label: 'Option A', value: 'a' },
      { label: 'Option B', value: 'b' },
      { label: 'Option C', value: 'c' },
    ],
  },
  editor: () => null,
  override: () => null,
  process: (v: unknown) => v,
  shouldApply: () => true,
};

const setup = (value: string[] = [], settings = defaultItem.settings) => {
  const onChange = jest.fn();
  render(
    <MultiSelectValueEditor
      value={value}
      onChange={onChange}
      item={{ ...defaultItem, settings }}
      context={{ data: [] }}
      id="multi-select-editor"
    />
  );
  return { onChange };
};

describe('MultiSelectValueEditor', () => {
  it('renders without crashing', async () => {
    setup();
    await waitFor(() => expect(screen.getByRole('combobox')).toBeInTheDocument());
  });

  it('shows existing selected values', async () => {
    setup(['a', 'b']);
    await waitFor(() => {
      expect(screen.getByText('Option A')).toBeInTheDocument();
      expect(screen.getByText('Option B')).toBeInTheDocument();
    });
  });

  it('calls onChange when an option is selected', async () => {
    const { onChange } = setup([]);
    const combobox = await screen.findByRole('combobox');
    await userEvent.type(combobox, '{arrowdown}');
    const option = await screen.findByText('Option A');
    await userEvent.click(option);
    expect(onChange).toHaveBeenCalledWith(['a']);
  });

  it('loads options via getOptions', async () => {
    const getOptions = jest.fn().mockResolvedValue([{ label: 'Dynamic', value: 'dyn' }]);
    setup([], { getOptions });
    await waitFor(() => expect(getOptions).toHaveBeenCalled());
  });
});
