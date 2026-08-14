import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { reportInteraction } from '@grafana/runtime';

import { GenerateDashboardModal } from './GenerateDashboardModal';
import { startPlanningInAssistant } from './handoff';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
  getDataSourceSrv: () => ({ getList: () => [] }),
}));

jest.mock('./handoff', () => ({
  startPlanningInAssistant: jest.fn(),
}));

const mockStartPlanning = jest.mocked(startPlanningInAssistant);

describe('GenerateDashboardModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStartPlanning.mockReturnValue(true);
  });

  /** Types a prompt and submits it with the modal's own button. */
  async function typeAndSubmit(prompt = 'monitor checkout') {
    await userEvent.type(screen.getByTestId('dashboard-prompt-input'), prompt);
    await userEvent.click(screen.getByRole('button', { name: 'Build it' }));
  }

  it('leaves focus to the prompt input instead of the close button', async () => {
    render(<GenerateDashboardModal onDismiss={jest.fn()} />);

    const input = screen.getByPlaceholderText(/Error rates and latency/i);
    await waitFor(() => expect(input).toHaveFocus());
  });

  it('closes and reports the interaction once planning has started', async () => {
    const onDismiss = jest.fn();
    render(<GenerateDashboardModal onDismiss={onDismiss} />);

    await typeAndSubmit();

    expect(mockStartPlanning).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalled();
    expect(reportInteraction).toHaveBeenCalledWith('dashboard_prompt_planning_started');
  });

  it('stays open when navigation was refused, so the typed prompt survives', async () => {
    // An unsaved dashboard blocked the redirect and is asking the user what to do.
    mockStartPlanning.mockReturnValue(false);
    const onDismiss = jest.fn();
    render(<GenerateDashboardModal onDismiss={onDismiss} />);

    await typeAndSubmit();

    expect(onDismiss).not.toHaveBeenCalled();
    expect(screen.getByTestId('dashboard-prompt-input')).toHaveValue('monitor checkout');
    // Nothing was started, so nothing should be reported as started either.
    expect(reportInteraction).not.toHaveBeenCalledWith('dashboard_prompt_planning_started');
  });

  it('passes the seeded folder through to the handoff', async () => {
    render(<GenerateDashboardModal seed={{ folderUid: 'folder-1' }} onDismiss={jest.fn()} />);

    await typeAndSubmit();

    expect(mockStartPlanning).toHaveBeenCalledWith(expect.objectContaining({ folderUid: 'folder-1' }));
  });
});
