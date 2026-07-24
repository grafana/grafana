import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TestProvider } from 'test/helpers/TestProvider';

import { SortOrder } from 'app/core/utils/richHistoryTypes';

import { Tabs } from '../QueriesDrawer/QueriesDrawerContext';

import { RichHistory, type RichHistoryProps } from './RichHistory';

jest.mock('../state/selectors', () => ({
  selectExploreDSMaps: jest.fn().mockReturnValue({ dsToExplore: [{ datasource: { uid: 'active-ds-uid' } }] }),
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => {
    return {
      getList: () => {
        return [];
      },
    };
  },
}));

// Stable identity: a fresh array per render would re-trigger effects that
// depend on the datasource list on every render.
const mockDataSourceItems = [{ name: 'active-ds', uid: 'active-ds-uid' }];

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  useDataSourceInstanceList: () => ({
    isLoading: false,
    items: mockDataSourceItems,
  }),
}));

jest.mock('react-use', () => ({
  ...jest.requireActual('react-use'),
  useAsync: () => ({ loading: false, value: [] }),
}));

const setup = (propOverrides?: Partial<RichHistoryProps>) => {
  const props: RichHistoryProps = {
    height: 100,
    richHistory: [],
    richHistoryTotal: 0,
    firstTab: Tabs.RichHistory,
    deleteRichHistory: jest.fn(),
    loadRichHistory: jest.fn().mockResolvedValue(undefined),
    loadMoreRichHistory: jest.fn(),
    clearRichHistoryResults: jest.fn(),
    onClose: jest.fn(),
    richHistorySearchFilters: {
      search: '',
      sortOrder: SortOrder.Descending,
      datasourceFilters: [],
      from: 0,
      to: 7,
      starred: false,
    },
    richHistorySettings: {
      retentionPeriod: 0,
      starredTabAsFirstTab: false,
      activeDatasourcesOnly: true,
      lastUsedDatasourceFilters: [],
    },
    updateHistorySearchFilters: jest.fn(),
    updateHistorySettings: jest.fn(),
  };

  Object.assign(props, propOverrides);

  render(
    <TestProvider>
      <RichHistory {...props} />
    </TestProvider>
  );
};

describe('RichHistory', () => {
  it('should render tabs as defined', () => {
    setup();
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(3);
    expect(tabs[0]).toHaveTextContent('Query history');
    expect(tabs[1]).toHaveTextContent('Starred');
    expect(tabs[2]).toHaveTextContent('Settings');
  });

  it('should render defined default', () => {
    setup();
    const tabs = screen.getAllByRole('tab');
    expect(tabs[0].className).toMatch(/-*activeTabStyle/);
    expect(tabs[1].className).not.toMatch(/-*activeTabStyle/);
  });

  it('should seed Starred filters from last-used filters, not the active datasource', async () => {
    const user = userEvent.setup();
    const updateHistorySearchFilters = jest.fn();
    setup({
      updateHistorySearchFilters,
      richHistorySettings: {
        retentionPeriod: 7,
        starredTabAsFirstTab: false,
        activeDatasourcesOnly: false,
        lastUsedDatasourceFilters: [],
      },
    });
    await screen.findByPlaceholderText(/search queries/i);
    updateHistorySearchFilters.mockClear();

    await user.click(screen.getByRole('tab', { name: 'Starred' }));
    expect(updateHistorySearchFilters).toHaveBeenLastCalledWith(
      expect.objectContaining({ datasourceFilters: [], starred: true })
    );

    await user.click(screen.getByRole('tab', { name: 'Query history' }));
    await user.click(screen.getByRole('tab', { name: 'Starred' }));
    expect(updateHistorySearchFilters).toHaveBeenLastCalledWith(
      expect.objectContaining({ datasourceFilters: [], starred: true })
    );
  });

  it('clears loading and shows an error when the history fetch rejects', async () => {
    const loadRichHistory = jest.fn().mockRejectedValue(new Error('boom'));
    setup({ loadRichHistory });

    // The debounced load fires ~300ms after mount; findBy polls until the rejection settles.
    expect(await screen.findByRole('alert', {}, { timeout: 2000 })).toBeInTheDocument();
    expect(screen.queryByText('Loading results...')).not.toBeInTheDocument();
  });

  it('does not surface an error when a superseded request rejects after a newer request succeeds', async () => {
    jest.useFakeTimers();
    try {
      const deferreds: Array<{ resolve: () => void; reject: (reason?: unknown) => void }> = [];
      const loadRichHistory = jest.fn(
        () => new Promise<void>((resolve, reject) => deferreds.push({ resolve, reject }))
      );
      setup({ loadRichHistory });

      // Mount seeds the filters, scheduling the first debounced load. Fire it (request #1).
      await act(async () => {
        jest.advanceTimersByTime(300);
      });
      expect(loadRichHistory).toHaveBeenCalledTimes(1);

      // A newer filter change schedules a second load (request #2, now the latest).
      fireEvent.change(screen.getByPlaceholderText(/search queries/i), { target: { value: 'foo' } });
      await act(async () => {
        jest.advanceTimersByTime(300);
      });
      expect(loadRichHistory).toHaveBeenCalledTimes(2);

      // The newer request settles first; the stale older one rejects afterwards and must be ignored.
      await act(async () => {
        deferreds[1].resolve();
        deferreds[0].reject(new Error('stale'));
      });

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    } finally {
      jest.useRealTimers();
    }
  });
});
