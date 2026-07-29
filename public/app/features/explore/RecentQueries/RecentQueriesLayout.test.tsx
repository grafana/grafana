import { render, screen } from '@testing-library/react';

import { SortOrder } from 'app/core/utils/richHistoryTypes';
import { type RichHistoryQuery } from 'app/types/explore';

import { RecentQueriesLayout } from './RecentQueriesLayout';
import { type RecentQueriesFilterState } from './useRecentQueriesData';

jest.mock('./RecentQueriesFilters', () => ({
  RecentQueriesFilters: jest.fn(() => <div data-testid="filters" />),
}));

jest.mock('./RecentQueriesList', () => ({
  RecentQueriesList: jest.fn(() => <div data-testid="list" />),
}));

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  useDataSourceInstanceList: jest.fn(() => ({
    isLoading: false,
    items: [
      { name: 'Prometheus', uid: 'prom-uid' },
      { name: 'Loki', uid: 'loki-uid' },
    ],
  })),
}));

const mockRichHistoryQuery: RichHistoryQuery = {
  id: 'rh-1',
  createdAt: 1700000000000,
  datasourceUid: 'prom-uid',
  datasourceName: 'Prometheus',
  starred: false,
  comment: '',
  queries: [{ refId: 'A', datasource: { uid: 'prom-uid', type: 'prometheus' } }],
};

const defaultFilters: RecentQueriesFilterState = {
  searchQuery: '',
  datasourceFilters: [],
  sortingOption: { value: SortOrder.Descending, label: 'Newest first' },
  showStarredOnly: false,
  rememberFilters: false,
};

const mockSetFilters = jest.fn();
const mockStarQuery = jest.fn();

let mockDataHook = {
  queries: [mockRichHistoryQuery],
  isLoading: false,
  isInitialLoad: false,
  error: undefined as unknown,
  settings: {
    retentionPeriod: 14,
    starredTabAsFirstTab: false,
    activeDatasourcesOnly: false,
    lastUsedDatasourceFilters: [],
  },
  filters: defaultFilters,
  setFilters: mockSetFilters,
  starQuery: mockStarQuery,
};

jest.mock('./useRecentQueriesData', () => ({
  useRecentQueriesData: () => mockDataHook,
}));

const mockOnSelectQuery = jest.fn();
const mockOnClose = jest.fn();
const mockOnSaveToLibrary = jest.fn();
const mockOnAnalyticsEvent = jest.fn();

const defaultProps = {
  onSelectQuery: mockOnSelectQuery,
  onClose: mockOnClose,
  onSaveToLibrary: mockOnSaveToLibrary,
  onAnalyticsEvent: mockOnAnalyticsEvent,
};

describe('RecentQueriesLayout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDataHook = {
      queries: [mockRichHistoryQuery],
      isLoading: false,
      isInitialLoad: false,
      error: undefined,
      settings: {
        retentionPeriod: 14,
        starredTabAsFirstTab: false,
        activeDatasourcesOnly: false,
        lastUsedDatasourceFilters: [],
      },
      filters: defaultFilters,
      setFilters: mockSetFilters,
      starQuery: mockStarQuery,
    };
  });

  it('renders filters and list side by side', () => {
    render(<RecentQueriesLayout {...defaultProps} />);
    expect(screen.getByTestId('filters')).toBeInTheDocument();
    expect(screen.getByTestId('list')).toBeInTheDocument();
  });

  it('shows error state when error is set', () => {
    mockDataHook.error = new Error('Network failure');
    render(<RecentQueriesLayout {...defaultProps} />);
    expect(screen.getByText('Something went wrong!')).toBeInTheDocument();
    expect(screen.getByText('Network failure')).toBeInTheDocument();
  });

  it('passes available datasources to filters', () => {
    render(<RecentQueriesLayout {...defaultProps} />);
    const { RecentQueriesFilters } = jest.requireMock('./RecentQueriesFilters');
    expect(RecentQueriesFilters).toHaveBeenCalledWith(
      expect.objectContaining({ availableDatasources: ['Prometheus', 'Loki'] }),
      expect.anything()
    );
  });

  it('handles select query by calling onSelectQuery and onClose props', () => {
    render(<RecentQueriesLayout {...defaultProps} />);
    const { RecentQueriesList } = jest.requireMock('./RecentQueriesList');
    const onSelectQuery = RecentQueriesList.mock.calls[0][0].onSelectQuery;

    onSelectQuery(mockRichHistoryQuery);

    expect(mockOnSelectQuery).toHaveBeenCalledWith(mockRichHistoryQuery);
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('handles star query by calling starQuery from the hook', () => {
    render(<RecentQueriesLayout {...defaultProps} />);
    const { RecentQueriesList } = jest.requireMock('./RecentQueriesList');
    const onStarQuery = RecentQueriesList.mock.calls[0][0].onStarQuery;

    onStarQuery('rh-1', true);

    expect(mockStarQuery).toHaveBeenCalledWith('rh-1', true);
    expect(mockOnAnalyticsEvent).toHaveBeenCalledWith('queryStarred', { starred: true });
  });

  it('handles save query by calling onSaveToLibrary prop', () => {
    render(<RecentQueriesLayout {...defaultProps} />);
    const { RecentQueriesList } = jest.requireMock('./RecentQueriesList');
    const onSaveQuery = RecentQueriesList.mock.calls[0][0].onSaveQuery;

    onSaveQuery(mockRichHistoryQuery);

    expect(mockOnSaveToLibrary).toHaveBeenCalledWith(mockRichHistoryQuery);
  });

  it('does not pass onSaveQuery to list when onSaveToLibrary is not provided', () => {
    render(<RecentQueriesLayout onSelectQuery={mockOnSelectQuery} onClose={mockOnClose} />);
    const { RecentQueriesList } = jest.requireMock('./RecentQueriesList');
    expect(RecentQueriesList.mock.calls[0][0].onSaveQuery).toBeUndefined();
  });

  it('passes onAnalyticsEvent to filters', () => {
    render(<RecentQueriesLayout {...defaultProps} />);
    const { RecentQueriesFilters } = jest.requireMock('./RecentQueriesFilters');
    expect(RecentQueriesFilters).toHaveBeenCalledWith(
      expect.objectContaining({ onAnalyticsEvent: mockOnAnalyticsEvent }),
      expect.anything()
    );
  });

  it('disables filters only during initial load', () => {
    mockDataHook.isInitialLoad = true;
    mockDataHook.isLoading = true;
    render(<RecentQueriesLayout {...defaultProps} />);
    const { RecentQueriesFilters } = jest.requireMock('./RecentQueriesFilters');
    expect(RecentQueriesFilters).toHaveBeenCalledWith(expect.objectContaining({ disabled: true }), expect.anything());
  });
});
