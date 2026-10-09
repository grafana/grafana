import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

import { isValidPromDuration } from '../../utils/promDuration';

import { DurationField } from './DurationField';

const label = 'Group wait';
const getInput = () => screen.getByRole('textbox', { name: label });

function Controlled({
  initial = '',
  onSubmit = jest.fn(),
  allowZero,
}: {
  initial?: string;
  onSubmit?: (value: string) => void;
  allowZero?: boolean;
}) {
  const [value, setValue] = useState(initial);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(value);
      }}
    >
      <DurationField label={label} value={value} onChange={setValue} placeholder="30s" allowZero={allowZero} />
    </form>
  );
}

describe('DurationField', () => {
  it('reports every edit to the parent as it is typed', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<DurationField label={label} value="" onChange={onChange} placeholder="30s" />);

    await user.type(getInput(), '4');

    expect(onChange).toHaveBeenLastCalledWith('4');
  });

  it('submits the edited value when Enter is pressed without leaving the field', async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    render(<Controlled initial="30s" onSubmit={onSubmit} />);

    await user.clear(getInput());
    await user.type(getInput(), '45s{Enter}');

    expect(onSubmit).toHaveBeenCalledWith('45s');
  });

  it('submits an invalid edit as typed, so the parent can reject it with isValidPromDuration', async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    render(<Controlled initial="30s" onSubmit={onSubmit} />);

    await user.clear(getInput());
    await user.type(getInput(), 'notaduration{Enter}');

    expect(onSubmit).toHaveBeenCalledWith('notaduration');
    expect(isValidPromDuration(onSubmit.mock.calls[0][0])).toBe(false);
  });

  it('waits for the field to lose focus before showing a validation error', async () => {
    const user = userEvent.setup();
    render(<Controlled />);

    await user.type(getInput(), 'notaduration');
    expect(screen.queryByText(/invalid duration format/i)).not.toBeInTheDocument();

    await user.tab();
    expect(await screen.findByText(/invalid duration format/i)).toBeInTheDocument();
  });

  it('clears the error once the value becomes valid', async () => {
    const user = userEvent.setup();
    render(<Controlled />);

    await user.type(getInput(), 'notaduration');
    await user.tab();
    expect(await screen.findByText(/invalid duration format/i)).toBeInTheDocument();

    await user.clear(getInput());
    await user.type(getInput(), '45s');

    expect(screen.queryByText(/invalid duration format/i)).not.toBeInTheDocument();
  });

  it('clears the error when the parent resets the value from the outside', async () => {
    const user = userEvent.setup();
    const props = { label, onChange: jest.fn(), placeholder: '30s' };
    const { rerender } = render(<DurationField {...props} value="notaduration" />);

    await user.click(getInput());
    await user.tab();
    expect(await screen.findByText(/invalid duration format/i)).toBeInTheDocument();

    rerender(<DurationField {...props} value="" />);

    expect(screen.queryByText(/invalid duration format/i)).not.toBeInTheDocument();
  });

  it('shows the value the parent provides', () => {
    const props = { label, onChange: jest.fn(), placeholder: '30s' };
    const { rerender } = render(<DurationField {...props} value="30s" />);
    expect(getInput()).toHaveValue('30s');

    rerender(<DurationField {...props} value="" />);

    expect(getInput()).toHaveValue('');
  });

  it('explains the format with a concrete example', async () => {
    const user = userEvent.setup();
    render(<Controlled />);

    await user.type(getInput(), 'notaduration');
    await user.tab();

    const error = await screen.findByText(/invalid duration format/i);
    expect(error).toHaveTextContent('30s or 5m');
    expect(error).not.toHaveTextContent('{{');
  });

  it('disables the input when disabled is set', () => {
    render(<DurationField label={label} value="" onChange={jest.fn()} placeholder="30s" disabled />);

    expect(getInput()).toBeDisabled();
  });

  it('accepts zero by default', async () => {
    render(<Controlled initial="0s" />);

    await userEvent.click(getInput());
    await userEvent.tab();

    expect(screen.queryByText(/greater than zero/i)).not.toBeInTheDocument();
  });

  it('rejects zero with its own message when allowZero is false', async () => {
    render(<Controlled initial="0s" allowZero={false} />);

    await userEvent.click(getInput());
    await userEvent.tab();

    expect(screen.getByText(/greater than zero/i)).toBeInTheDocument();
  });
});
