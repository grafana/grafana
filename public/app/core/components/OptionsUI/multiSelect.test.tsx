import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { SelectFieldConfigSettings, StandardEditorProps } from '@grafana/data';

import { MultiSelectValueEditor } from './multiSelect';

const multiSelectSettings: SelectFieldConfigSettings<string> = {
  options: [
    { label: 'A', value: 'a' },
    { label: 'B', value: 'b' },
  ],
};

type MultiSelectEditorProps = StandardEditorProps<string[], SelectFieldConfigSettings<string>>;

describe('MultiSelectValueEditor', () => {
  const buildProps = (overrides: Partial<MultiSelectEditorProps>): MultiSelectEditorProps => ({
    value: ['a'],
    onChange: jest.fn(),
    item: {
      id: 'multi-select-item',
      name: 'Multi select',
      settings: multiSelectSettings,
    },
    context: { data: [] },
    id: 'multi-select-test',
    ...overrides,
  });

  it('flattens selected values in onChange', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<MultiSelectValueEditor {...buildProps({ onChange, value: [] })} />);

    await waitFor(() => expect(screen.queryByText('Loading options')).not.toBeInTheDocument());

    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: /^A$/i }));

    expect(onChange).toHaveBeenCalledWith(['a']);
  });
});
