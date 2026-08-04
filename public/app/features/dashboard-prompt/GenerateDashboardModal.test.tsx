import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AssistantPromptCardView } from '@grafana/assistant';
import { reportInteraction } from '@grafana/runtime';

import { GenerateDashboardModal } from './GenerateDashboardModal';
import { startPlanningInAssistant } from './handoff';

// Stand in for the SDK card with something that focuses its own input on mount
// the way the real one does (requestAnimationFrame → input.focus()), so the test
// exercises the modal's focus handling rather than the SDK's internals.
jest.mock('@grafana/assistant', () => ({
  openAssistant: jest.fn(),
  AssistantPromptCardView: jest.fn(),
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
  getDataSourceSrv: () => ({ getList: () => [] }),
}));

jest.mock('./handoff', () => ({
  startPlanningInAssistant: jest.fn(),
}));

const mockCard = jest.mocked(AssistantPromptCardView);
const mockStartPlanning = jest.mocked(startPlanningInAssistant);

function SelfFocusingCard({ placeholder }: { placeholder?: string }) {
  return <input placeholder={placeholder} ref={(el) => requestAnimationFrame(() => el?.focus())} />;
}

describe('GenerateDashboardModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCard.mockImplementation(({ placeholder }) => <SelfFocusingCard placeholder={placeholder} />);
    mockStartPlanning.mockReturnValue(true);
  });

  /** Renders with a card whose button submits a fixed prompt. */
  function renderWithSubmitButton(onDismiss = jest.fn()) {
    mockCard.mockImplementation(({ onSubmit }) => (
      <button type="button" onClick={() => onSubmit?.('monitor checkout')}>
        submit
      </button>
    ));
    render(<GenerateDashboardModal onDismiss={onDismiss} />);
    return onDismiss;
  }

  it('leaves focus to the prompt input instead of the close button', async () => {
    render(<GenerateDashboardModal onDismiss={jest.fn()} />);

    const input = screen.getByPlaceholderText(/Error rates and latency/i);
    await waitFor(() => expect(input).toHaveFocus());
  });

  it('closes and reports the interaction once planning has started', async () => {
    const onDismiss = renderWithSubmitButton();

    await userEvent.click(screen.getByRole('button', { name: 'submit' }));

    expect(mockStartPlanning).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalled();
    expect(reportInteraction).toHaveBeenCalledWith('dashboard_prompt_planning_started');
  });

  it('stays open when navigation was refused, so the typed prompt survives', async () => {
    // An unsaved dashboard blocked the redirect and is asking the user what to do.
    mockStartPlanning.mockReturnValue(false);
    const onDismiss = renderWithSubmitButton();

    await userEvent.click(screen.getByRole('button', { name: 'submit' }));

    expect(onDismiss).not.toHaveBeenCalled();
    // Nothing was started, so nothing should be reported as started either.
    expect(reportInteraction).not.toHaveBeenCalledWith('dashboard_prompt_planning_started');
  });

  it('passes the seeded folder through to the handoff', async () => {
    mockCard.mockImplementation(({ onSubmit }) => (
      <button type="button" onClick={() => onSubmit?.('monitor checkout')}>
        submit
      </button>
    ));
    render(<GenerateDashboardModal seed={{ folderUid: 'folder-1' }} onDismiss={jest.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: 'submit' }));

    expect(mockStartPlanning).toHaveBeenCalledWith(expect.objectContaining({ folderUid: 'folder-1' }));
  });
});
