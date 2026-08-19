import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { PromptForm } from './PromptForm';

describe('PromptForm', () => {
  const buildIt = () => screen.getByRole('button', { name: 'Build it' });

  it('hands the trimmed prompt to the submit handler', async () => {
    const onSubmitPrompt = jest.fn();
    render(<PromptForm onSubmitPrompt={onSubmitPrompt} onDismiss={jest.fn()} />);

    await userEvent.type(screen.getByTestId('dashboard-prompt-input'), '  monitor checkout  ');
    await userEvent.click(buildIt());

    expect(onSubmitPrompt).toHaveBeenCalledWith('monitor checkout');
  });

  it('submits on Enter as well as from the button', async () => {
    const onSubmitPrompt = jest.fn();
    render(<PromptForm onSubmitPrompt={onSubmitPrompt} onDismiss={jest.fn()} />);

    await userEvent.type(screen.getByTestId('dashboard-prompt-input'), 'monitor checkout{Enter}');

    expect(onSubmitPrompt).toHaveBeenCalledWith('monitor checkout');
  });

  it('keeps the submit button disabled until something is typed', async () => {
    const onSubmitPrompt = jest.fn();
    render(<PromptForm onSubmitPrompt={onSubmitPrompt} onDismiss={jest.fn()} />);

    expect(buildIt()).toBeDisabled();

    // Whitespace alone is not a prompt.
    await userEvent.type(screen.getByTestId('dashboard-prompt-input'), '   ');
    expect(buildIt()).toBeDisabled();

    await userEvent.type(screen.getByTestId('dashboard-prompt-input'), 'checkout');
    expect(buildIt()).toBeEnabled();
  });

  it('closes without submitting when cancelled', async () => {
    const onSubmitPrompt = jest.fn();
    const onDismiss = jest.fn();
    render(<PromptForm onSubmitPrompt={onSubmitPrompt} onDismiss={onDismiss} />);

    await userEvent.type(screen.getByTestId('dashboard-prompt-input'), 'monitor checkout');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onDismiss).toHaveBeenCalled();
    expect(onSubmitPrompt).not.toHaveBeenCalled();
  });
});
