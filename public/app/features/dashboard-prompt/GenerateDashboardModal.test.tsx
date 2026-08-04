import { render, screen, waitFor } from '@testing-library/react';

import { AssistantPromptCardView } from '@grafana/assistant';

import { GenerateDashboardModal } from './GenerateDashboardModal';

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

const mockCard = jest.mocked(AssistantPromptCardView);

function SelfFocusingCard({ placeholder }: { placeholder?: string }) {
  return <input placeholder={placeholder} ref={(el) => requestAnimationFrame(() => el?.focus())} />;
}

describe('GenerateDashboardModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCard.mockImplementation(({ placeholder }) => <SelfFocusingCard placeholder={placeholder} />);
  });

  it('leaves focus to the prompt input instead of the close button', async () => {
    render(<GenerateDashboardModal onDismiss={jest.fn()} />);

    const input = screen.getByPlaceholderText(/Error rates and latency/i);
    await waitFor(() => expect(input).toHaveFocus());
  });
});
