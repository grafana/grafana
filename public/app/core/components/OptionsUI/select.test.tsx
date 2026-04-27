import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { SelectFieldConfigSettings, StandardEditorProps } from '@grafana/data/field';

import { SelectValueEditor } from './select';

const selectSettings: SelectFieldConfigSettings<string> = {
  options: [
    { label: 'A', value: 'a' },
    { label: 'B', value: 'b' },
  ],
};

type SelectEditorProps = StandardEditorProps<string, SelectFieldConfigSettings<string>>;

describe('SelectValueEditor', () => {
  const buildProps = (overrides: Partial<SelectEditorProps>): SelectEditorProps => ({
    value: 'b',
    onChange: jest.fn(),
    item: {
      id: 'select-item',
      name: 'Select',
      settings: selectSettings,
    },
    context: { data: [] },
    id: 'select-test',
    ...overrides,
  });

  it('loads static options and displays current selection', async () => {
    render(<SelectValueEditor {...buildProps({})} />);

    await waitFor(() => {
      expect(screen.queryByText('Loading options')).not.toBeInTheDocument();
    });

    expect(screen.getByText('B')).toBeVisible();
  });

  it('calls onChange when another option is chosen', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<SelectValueEditor {...buildProps({ onChange })} />);

    await screen.findByRole('combobox');

    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: /^A$/i }));

    expect(onChange).toHaveBeenCalledWith('a');
  });

  it('shows unknown value as a fallback option label', async () => {
    render(<SelectValueEditor {...buildProps({ value: 'orphan' })} />);

    await waitFor(() => expect(screen.queryByText('Loading options')).not.toBeInTheDocument());

    expect(screen.getByText('orphan')).toBeVisible();
  });
});
