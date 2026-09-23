import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DurationField, type DurationFieldProps } from './DurationField';

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

  it('picks up a later value prop change from the parent', () => {
    const props: DurationFieldProps = { label: 'Group wait', value: '30s', onChange: jest.fn(), placeholder: '30s' };
    const { rerender } = render(<DurationField {...props} />);

    expect(screen.getByRole('textbox', { name: 'Group wait' })).toHaveValue('30s');

    rerender(<DurationField {...props} value="" />);

    expect(screen.getByRole('textbox', { name: 'Group wait' })).toHaveValue('');
  });

  it('includes a concrete example in the validation error, not raw placeholder tokens', async () => {
    const user = userEvent.setup();
    render(<DurationField label="Group wait" value="" onChange={jest.fn()} placeholder="30s" />);

    await user.type(screen.getByRole('textbox', { name: 'Group wait' }), 'notaduration');
    await user.tab();

    const error = await screen.findByText(/invalid duration format/i);
    expect(error).not.toHaveTextContent('{{');
  });

  it('clears a stale validation error when the parent resets value from the outside', async () => {
    const user = userEvent.setup();
    const props: DurationFieldProps = { label: 'Group wait', value: '30s', onChange: jest.fn(), placeholder: '30s' };
    const { rerender } = render(<DurationField {...props} />);

    await user.clear(screen.getByRole('textbox', { name: 'Group wait' }));
    await user.type(screen.getByRole('textbox', { name: 'Group wait' }), 'notaduration');
    await user.tab();
    expect(await screen.findByText(/invalid duration format/i)).toBeInTheDocument();

    // A genuine external reset (e.g. clearing the contact point resets every timing field) - must
    // actually change `value` for the resync effect to fire at all.
    rerender(<DurationField {...props} value="" />);

    expect(screen.queryByText(/invalid duration format/i)).not.toBeInTheDocument();
  });
});
