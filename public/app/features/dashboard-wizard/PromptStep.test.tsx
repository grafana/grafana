import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AssistantPromptCardView, openAssistant } from '@grafana/assistant';

import { PromptStep } from './PromptStep';

// The SDK's prompt card owns the input; stub it with a button that submits a
// fixed prompt through whatever `openAssistant` the wizard passed in, so the
// test exercises the wizard's interception rather than the SDK's internals.
jest.mock('@grafana/assistant', () => ({
  openAssistant: jest.fn(),
  AssistantPromptCardView: jest.fn(),
}));

jest.mock('./WizardContextPicker', () => ({
  WizardContextPicker: () => null,
}));

const mockCard = jest.mocked(AssistantPromptCardView);
const mockOpenAssistant = jest.mocked(openAssistant);

describe('PromptStep', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCard.mockImplementation(({ openAssistant: open }) => (
      <button type="button" onClick={() => open({ origin: 'test', prompt: 'monitor checkout' })}>
        submit
      </button>
    ));
  });

  it('routes a submitted prompt to the wizard instead of opening the assistant itself', async () => {
    const onSubmitPrompt = jest.fn();
    render(
      <PromptStep
        contextItems={[]}
        onAddContextItem={jest.fn()}
        onRemoveContextItem={jest.fn()}
        onSubmitPrompt={onSubmitPrompt}
        onDismiss={jest.fn()}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: 'submit' }));

    expect(onSubmitPrompt).toHaveBeenCalledWith('monitor checkout');
    // The wizard navigates and attaches planning context itself (see handoff.ts),
    // so the SDK's own openAssistant must never fire from the card.
    expect(mockOpenAssistant).not.toHaveBeenCalled();
  });

  it('gives the card the dashboarding mode and the wizard origin', () => {
    render(
      <PromptStep
        contextItems={[]}
        onAddContextItem={jest.fn()}
        onRemoveContextItem={jest.fn()}
        onSubmitPrompt={jest.fn()}
        onDismiss={jest.fn()}
      />
    );

    expect(mockCard).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'dashboarding', origin: 'grafana/dashboard-wizard' }),
      expect.anything()
    );
  });

  it('ignores an empty submission', async () => {
    const onSubmitPrompt = jest.fn();
    mockCard.mockImplementation(({ openAssistant: open }) => (
      <button type="button" onClick={() => open({ origin: 'test' })}>
        submit
      </button>
    ));
    render(
      <PromptStep
        contextItems={[]}
        onAddContextItem={jest.fn()}
        onRemoveContextItem={jest.fn()}
        onSubmitPrompt={onSubmitPrompt}
        onDismiss={jest.fn()}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: 'submit' }));

    expect(onSubmitPrompt).not.toHaveBeenCalled();
  });
});
