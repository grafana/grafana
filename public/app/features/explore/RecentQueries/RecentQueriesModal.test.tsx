import { act, render, screen } from '@testing-library/react';

import { reportInteraction } from '@grafana/runtime';
import { type RichHistoryQuery } from 'app/types/explore';

import { RecentQueriesModal } from './RecentQueriesModal';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

jest.mock('app/core/utils/richHistory', () => ({
  ...jest.requireActual('app/core/utils/richHistory'),
  getRichHistorySettings: jest.fn().mockResolvedValue({ retentionPeriod: 14 }),
}));

// The modal fetches retention settings asynchronously; flush that state update inside act.
const renderModal = async (props: Parameters<typeof RecentQueriesModal>[0]) => {
  await act(async () => {
    render(<RecentQueriesModal {...props} />);
  });
};

jest.mock('./RecentQueriesLayout', () => ({
  RecentQueriesLayout: jest.fn(
    ({ onSelectQuery, onClose }: { onSelectQuery: (q: RichHistoryQuery) => void; onClose: () => void }) => (
      <div data-testid="recent-queries-layout">
        <button
          onClick={() => {
            const mockQuery: RichHistoryQuery = {
              id: '1',
              createdAt: 1000,
              datasourceUid: 'prom',
              datasourceName: 'Prometheus',
              starred: false,
              comment: '',
              queries: [{ refId: 'A', datasource: { uid: 'prom', type: 'prometheus' } }],
            };
            onSelectQuery(mockQuery);
          }}
        >
          select
        </button>
        <button onClick={onClose}>close</button>
      </div>
    )
  ),
}));

describe('RecentQueriesModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    onSelectQuery: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the modal when isOpen is true', async () => {
    await renderModal(defaultProps);
    expect(screen.getByTestId('recent-queries-layout')).toBeInTheDocument();
  });

  it('does not render modal content when isOpen is false', async () => {
    await renderModal({ ...defaultProps, isOpen: false });
    expect(screen.queryByTestId('recent-queries-layout')).not.toBeInTheDocument();
  });

  it('renders Recent queries tab as active', async () => {
    await renderModal(defaultProps);
    expect(screen.getByRole('tab', { name: /recent queries/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /recent queries/i })).toHaveAttribute('aria-selected', 'true');
  });

  it('renders Saved queries tab as disabled', async () => {
    await renderModal(defaultProps);
    const savedTab = screen.getByRole('tab', { name: /saved queries/i });
    expect(savedTab).toBeInTheDocument();
    expect(savedTab).toHaveAttribute('aria-disabled', 'true');
  });

  it('calls onSelectQuery with all queries from the entry when selected', async () => {
    await renderModal(defaultProps);
    screen.getByText('select').click();
    expect(defaultProps.onSelectQuery).toHaveBeenCalledWith(
      [{ refId: 'A', datasource: { uid: 'prom', type: 'prometheus' } }],
      'Prometheus'
    );
  });

  it('calls onClose when dismiss is triggered', async () => {
    await renderModal(defaultProps);
    screen.getByText('close').click();
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('reports an opened event when the modal opens', async () => {
    await renderModal(defaultProps);
    expect(reportInteraction).toHaveBeenCalledWith('grafana_explore_query_history_recent_queries', { event: 'opened' });
  });

  it('does not report an opened event when the modal is closed', async () => {
    await renderModal({ ...defaultProps, isOpen: false });
    expect(reportInteraction).not.toHaveBeenCalledWith(
      'grafana_explore_query_history_recent_queries',
      expect.objectContaining({ event: 'opened' })
    );
  });

  it('reports a querySelected event when a query is chosen', async () => {
    await renderModal(defaultProps);
    screen.getByText('select').click();
    expect(reportInteraction).toHaveBeenCalledWith(
      'grafana_explore_query_history_recent_queries',
      expect.objectContaining({ event: 'querySelected', datasourceName: 'Prometheus' })
    );
  });
});
