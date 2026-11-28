import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { SoftBlockPrompt } from './SoftBlockPrompt';

const TEXT = 'query range 2d exceeds the soft limit of 1d.\n(Trace ID: abc123)';

describe('SoftBlockPrompt', () => {
  it('renders the guardrail title and the provided text', () => {
    render(<SoftBlockPrompt text={TEXT} onContinue={jest.fn()} />);

    expect(screen.getByText('Query paused by a guardrail')).toBeInTheDocument();
    expect(screen.getByText(/query range 2d exceeds the soft limit of 1d/)).toBeInTheDocument();
    expect(screen.getByText(/Trace ID: abc123/)).toBeInTheDocument();
  });

  it('disables Continue initially', () => {
    render(<SoftBlockPrompt text={TEXT} onContinue={jest.fn()} />);

    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
  });

  it('keeps Continue disabled with 9 characters', async () => {
    const user = userEvent.setup();
    render(<SoftBlockPrompt text={TEXT} onContinue={jest.fn()} />);

    await user.type(screen.getByRole('textbox'), '123456789');

    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
  });

  it('keeps Continue disabled for whitespace-only input', async () => {
    const user = userEvent.setup();
    render(<SoftBlockPrompt text={TEXT} onContinue={jest.fn()} />);

    await user.type(screen.getByRole('textbox'), '              ');

    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
  });

  it('enables Continue once there are 10 characters after trimming', async () => {
    const user = userEvent.setup();
    render(<SoftBlockPrompt text={TEXT} onContinue={jest.fn()} />);

    await user.type(screen.getByRole('textbox'), '  abcdefghij  ');

    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled();
  });

  it('calls onContinue once with the trimmed reason when clicked', async () => {
    const user = userEvent.setup();
    const onContinue = jest.fn();
    render(<SoftBlockPrompt text={TEXT} onContinue={onContinue} />);

    await user.type(screen.getByRole('textbox'), '   investigating an incident   ');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(onContinue).toHaveBeenCalledWith('investigating an incident');
  });

  it('does not submit when Enter is pressed in the textarea', async () => {
    const user = userEvent.setup();
    const onContinue = jest.fn();
    render(<SoftBlockPrompt text={TEXT} onContinue={onContinue} />);

    const textarea = screen.getByRole('textbox');
    await user.type(textarea, 'investigating an incident');
    await user.type(textarea, '{Enter}');

    expect(onContinue).not.toHaveBeenCalled();
  });
});
