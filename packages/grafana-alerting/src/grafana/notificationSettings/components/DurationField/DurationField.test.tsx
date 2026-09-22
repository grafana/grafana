import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DurationField } from './DurationField';

describe('DurationField', () => {
  it('calls onChange with the typed value on blur', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<DurationField label="Group wait" value="" onChange={onChange} placeholder="30s" />);

    await user.type(screen.getByRole('textbox', { name: 'Group wait' }), '45s');
    await user.tab();

    expect(onChange).toHaveBeenCalledWith('45s');
  });

  it('shows a validation error for a malformed duration', async () => {
    const user = userEvent.setup();
    render(<DurationField label="Group wait" value="" onChange={jest.fn()} placeholder="30s" />);

    await user.type(screen.getByRole('textbox', { name: 'Group wait' }), 'notaduration');
    await user.tab();

    expect(await screen.findByText(/invalid duration format/i)).toBeInTheDocument();
  });

  it('disables the input when disabled is set', () => {
    render(<DurationField label="Group wait" value="" onChange={jest.fn()} placeholder="30s" disabled />);

    expect(screen.getByRole('textbox', { name: 'Group wait' })).toBeDisabled();
  });
});
