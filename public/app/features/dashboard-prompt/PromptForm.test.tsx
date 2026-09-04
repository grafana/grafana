import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { PromptForm } from './PromptForm';
import { surprisePrompts } from './surprisePrompts';

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

  describe('Surprise Me button', () => {
    it('populates the input with a random prompt when clicked', async () => {
      render(<PromptForm onSubmitPrompt={jest.fn()} onDismiss={jest.fn()} />);

      const surpriseButton = screen.getByTestId('dashboard-prompt-surprise-button');
      const input = screen.getByTestId('dashboard-prompt-input') as HTMLInputElement;

      expect(input.value).toBe('');

      await userEvent.click(surpriseButton);

      expect(input.value).not.toBe('');
      expect(surprisePrompts).toContain(input.value);
    });

    it('replaces existing input text with a new surprise prompt', async () => {
      render(<PromptForm onSubmitPrompt={jest.fn()} onDismiss={jest.fn()} />);

      const surpriseButton = screen.getByTestId('dashboard-prompt-surprise-button');
      const input = screen.getByTestId('dashboard-prompt-input') as HTMLInputElement;

      await userEvent.type(input, 'my existing prompt');
      expect(input.value).toBe('my existing prompt');

      await userEvent.click(surpriseButton);

      expect(input.value).not.toBe('my existing prompt');
      expect(surprisePrompts).toContain(input.value);
    });

    it('enables the submit button after surprise prompt is populated', async () => {
      render(<PromptForm onSubmitPrompt={jest.fn()} onDismiss={jest.fn()} />);

      const surpriseButton = screen.getByTestId('dashboard-prompt-surprise-button');
      const submitButton = buildIt();

      expect(submitButton).toBeDisabled();

      await userEvent.click(surpriseButton);

      expect(submitButton).toBeEnabled();
    });

    it('allows submission of a surprise prompt', async () => {
      const onSubmitPrompt = jest.fn();
      render(<PromptForm onSubmitPrompt={onSubmitPrompt} onDismiss={jest.fn()} />);

      const surpriseButton = screen.getByTestId('dashboard-prompt-surprise-button');
      await userEvent.click(surpriseButton);

      const input = screen.getByTestId('dashboard-prompt-input') as HTMLInputElement;
      const populatedPrompt = input.value;

      await userEvent.click(buildIt());

      expect(onSubmitPrompt).toHaveBeenCalledWith(populatedPrompt);
      expect(surprisePrompts).toContain(populatedPrompt);
    });
  });
});
