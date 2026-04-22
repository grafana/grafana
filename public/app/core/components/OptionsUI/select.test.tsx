import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { SelectValueEditor } from './select';

const defaultItem = {
  id: 'select',
  name: 'Select',
  description: '',
  settings: {
    options: [
      { label: 'Option A', value: 'a' },
      { label: 'Option B', value: 'b' },
    ],
  },
  editor: () => null,
  override: () => null,
  process: (v: unknown) => v,
  shouldApply: () => true,
};

const setup = (value: string | undefined, settings = defaultItem.settings) => {
  const onChange = jest.fn();
  render(
    <SelectValueEditor
      value={value}
      onChange={onChange}
      item={{ ...defaultItem, settings }}
      context={{ data: [] }}
      id="select-editor"
    />
  );
  return { onChange };
};

describe('SelectValueEditor', () => {
  it('renders without crashing', async () => {
    setup(undefined);
    await waitFor(() => expect(screen.getByRole('combobox')).toBeInTheDocument());
  });

  it('displays current value', async () => {
    setup('a');
    await waitFor(() => expect(screen.getByText('Option A')).toBeInTheDocument());
  });

  it('shows options on open', async () => {
    setup(undefined);
    const combobox = await screen.findByRole('combobox');
    await userEvent.type(combobox, '{arrowdown}');
    expect(await screen.findByText('Option A')).toBeInTheDocument();
    expect(await screen.findByText('Option B')).toBeInTheDocument();
  });

  it('calls onChange when an option is selected', async () => {
    const { onChange } = setup(undefined);
    const combobox = await screen.findByRole('combobox');
    await userEvent.type(combobox, '{arrowdown}');
    const option = await screen.findByText('Option A');
    await userEvent.click(option);
    expect(onChange).toHaveBeenCalledWith('a');
  });

  it('loads options via getOptions', async () => {
    const getOptions = jest.fn().mockResolvedValue([{ label: 'Dynamic', value: 'dyn' }]);
    setup(undefined, { getOptions });
    await waitFor(() => expect(getOptions).toHaveBeenCalled());
  });
});
