import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { StandardEditorProps } from '@grafana/data';

import { MultiSelectValueEditor } from './multiSelect';

describe('MultiSelectValueEditor', () => {
  const buildProps = (
    overrides: Partial<StandardEditorProps<string[], { options?: Array<{ label: string; value: string }> }>>
  ): StandardEditorProps<string[], { options?: Array<{ label: string; value: string }> }> => ({
    value: ['a'],
    onChange: jest.fn(),
    item: {
      settings: {
        options: [
          { label: 'A', value: 'a' },
          { label: 'B', value: 'b' },
        ],
      },
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
