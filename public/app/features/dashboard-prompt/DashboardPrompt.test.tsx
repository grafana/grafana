import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AssistantPromptCardView, openAssistant } from '@grafana/assistant';

import { DashboardPrompt } from './DashboardPrompt';

// The SDK's prompt card owns the input; stub it with a button that reports a
// fixed prompt through the props the modal passed in, so the test exercises the
// feature's own wiring rather than the SDK's internals.
jest.mock('@grafana/assistant', () => ({
  openAssistant: jest.fn(),
  AssistantPromptCardView: jest.fn(),
}));

const mockCard = jest.mocked(AssistantPromptCardView);
const mockOpenAssistant = jest.mocked(openAssistant);

describe('DashboardPrompt', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCard.mockImplementation(({ openAssistant: open, onSubmit }) => (
      <button
        type="button"
        onClick={() => {
          open({ origin: 'test', prompt: 'monitor checkout' });
          onSubmit?.('monitor checkout');
        }}
      >
        submit
      </button>
    ));
  });

  it('routes a submitted prompt to the handoff instead of opening the assistant itself', async () => {
    const onSubmitPrompt = jest.fn();
    render(<DashboardPrompt onSubmitPrompt={onSubmitPrompt} onDismiss={jest.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: 'submit' }));

    expect(onSubmitPrompt).toHaveBeenCalledWith('monitor checkout');
    // The handoff navigates and attaches planning context itself (see handoff.ts),
    // so the SDK's own openAssistant must never fire from the card.
    expect(mockOpenAssistant).not.toHaveBeenCalled();
  });

  it('gives the card the dashboarding mode and the feature origin', () => {
    render(<DashboardPrompt onSubmitPrompt={jest.fn()} onDismiss={jest.fn()} />);

    expect(mockCard).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'dashboarding', origin: 'grafana/dashboard-prompt' }),
      expect.anything()
    );
  });
});
