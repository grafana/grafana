import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { UnitValueEditor } from './units';

type EditorItem = Parameters<typeof UnitValueEditor>[0]['item'];

describe('UnitValueEditor', () => {
  it('renders the unit picker without a clear button when not clearable', () => {
    render(
      <UnitValueEditor
        value="bytes"
        onChange={jest.fn()}
        item={{ settings: {} } as EditorItem}
        context={{ data: [] }}
        id="u1"
      />
    );

    expect(screen.getByPlaceholderText('Choose')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /clear unit selection/i })).not.toBeInTheDocument();
  });

  it('shows a clear button when clearable and a value is set, and calls onChange(undefined) on click', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();

    render(
      <UnitValueEditor
        value="short"
        onChange={onChange}
        item={{ settings: { isClearable: true } } as EditorItem}
        context={{ data: [] }}
        id="u2"
      />
    );

    await user.click(screen.getByRole('button', { name: /clear unit selection/i }));

    expect(onChange).toHaveBeenCalledWith(undefined);
  });
});
