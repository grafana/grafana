import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { type PulseHook } from '../types';

import PulseHooksListPage from './PulseHooksListPage';

const useListHooksQueryMock = jest.fn();
const deleteHookMock = jest.fn();

jest.mock('../api/pulseApi', () => ({
  useListHooksQuery: () => useListHooksQueryMock(),
  useDeleteHookMutation: () => [deleteHookMock, { isLoading: false }],
}));

// Page pulls in the full app chrome (nav index, redux) which is heavier
// than this unit needs and depends on env-only build artifacts. Stub it
// to a passthrough so the test exercises the list/table/delete logic.
jest.mock('app/core/components/Page/Page', () => ({
  Page: Object.assign(
    ({ children, actions }: { children?: React.ReactNode; actions?: React.ReactNode }) => (
      <div>
        {actions}
        {children}
      </div>
    ),
    { Contents: ({ children }: { children?: React.ReactNode }) => <div>{children}</div> }
  ),
}));

function hook(overrides: Partial<PulseHook> = {}): PulseHook {
  return {
    uid: 'h1',
    orgId: 1,
    name: 'Grafana-P.S.',
    type: 'webhook',
    url: 'https://example.com/hook',
    disabled: false,
    createdBy: 1,
    created: '2026-01-01T00:00:00Z',
    updated: '2026-01-01T00:00:00Z',
    hasSecret: false,
    ...overrides,
  };
}

beforeEach(() => {
  useListHooksQueryMock.mockReset();
  deleteHookMock.mockReset();
  deleteHookMock.mockReturnValue({ unwrap: () => Promise.resolve() });
});

describe('PulseHooksListPage', () => {
  it('shows the empty state call-to-action when no hooks exist', () => {
    useListHooksQueryMock.mockReturnValue({ data: { hooks: [] }, isLoading: false, isError: false });
    render(<PulseHooksListPage />);
    expect(screen.getByText("You haven't created any Pulse hooks yet")).toBeInTheDocument();
  });

  it('renders a row per hook with a disabled badge', () => {
    useListHooksQueryMock.mockReturnValue({
      data: { hooks: [hook(), hook({ uid: 'h2', name: 'Slacker', disabled: true })] },
      isLoading: false,
      isError: false,
    });
    render(<PulseHooksListPage />);
    expect(screen.getByText('Grafana-P.S.')).toBeInTheDocument();
    expect(screen.getByText('Slacker')).toBeInTheDocument();
    expect(screen.getByText('Disabled')).toBeInTheDocument();
  });

  it('opens a confirm modal and deletes the hook on confirm', async () => {
    useListHooksQueryMock.mockReturnValue({ data: { hooks: [hook()] }, isLoading: false, isError: false });
    render(<PulseHooksListPage />);
    await userEvent.click(screen.getByLabelText('Delete hook Grafana-P.S.'));
    // Confirm modal title appears, then confirm.
    expect(screen.getByText('Delete Pulse hook')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(deleteHookMock).toHaveBeenCalledWith('h1');
  });
});
