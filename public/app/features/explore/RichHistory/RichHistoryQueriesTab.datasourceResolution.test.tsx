import { render, screen, waitFor } from '@testing-library/react';
import { TestProvider } from 'test/helpers/TestProvider';
import { MockDataSourceApi } from 'test/mocks/datasource_srv';

import { type DataSourceInstanceSettings, type DataSourcePluginMeta } from '@grafana/data';
import { getDataSourceInstance } from '@grafana/runtime/unstable';
import { SortOrder } from 'app/core/utils/richHistoryTypes';
import { type RichHistoryQuery } from 'app/types/explore';

import { RichHistoryQueriesTab, type RichHistoryQueriesTabProps } from './RichHistoryQueriesTab';

// This suite intentionally does NOT mock react-use's `useAsync`, so the component's real
// datasource-resolution effect runs. A previous version resolved the list with a bare
// (non-awaited) get inside a try/catch, so a single failing datasource rejected the whole
// Promise.all and left every card with "Data source does not exist anymore".
jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  getDataSourceInstance: jest.fn(),
}));

const getDataSourceInstanceMock = jest.mocked(getDataSourceInstance);

const goodDs = new MockDataSourceApi({ name: 'good', uid: 'good-123' } as DataSourceInstanceSettings, undefined, {
  info: { logos: { small: 'logo.svg' } },
} as DataSourcePluginMeta);

const query: RichHistoryQuery = {
  id: '1',
  createdAt: 0,
  datasourceUid: 'good-123',
  datasourceName: 'good',
  starred: false,
  comment: '',
  queries: [{ refId: 'A', datasource: { uid: 'good-123' } }],
};

const makeProps = (): RichHistoryQueriesTabProps => ({
  queries: [query],
  totalQueries: 1,
  loading: false,
  updateFilters: jest.fn(),
  clearRichHistoryResults: jest.fn(),
  loadMoreRichHistory: jest.fn(),
  activeDatasources: [],
  // The list contains a healthy datasource AND one whose instance fails to load.
  listOfDatasources: [
    { name: 'good', uid: 'good-123' },
    { name: 'bad', uid: 'bad-456' },
  ],
  isLoadingDatasources: false,
  richHistorySearchFilters: {
    search: '',
    sortOrder: SortOrder.Descending,
    datasourceFilters: [],
    from: 0,
    to: 30,
    starred: false,
  },
  richHistorySettings: {
    retentionPeriod: 30,
    activeDatasourcesOnly: false,
    lastUsedDatasourceFilters: [],
    starredTabAsFirstTab: false,
  },
  height: 100,
});

describe('RichHistoryQueriesTab datasource resolution', () => {
  beforeEach(() => {
    getDataSourceInstanceMock.mockImplementation((ref) => {
      if (ref === 'good-123') {
        return Promise.resolve(goodDs);
      }
      return Promise.reject(new Error(`Datasource ${ref} was not found`));
    });
  });

  afterEach(() => {
    getDataSourceInstanceMock.mockReset();
  });

  it('still resolves healthy datasources when another datasource in the list fails to load', async () => {
    render(<RichHistoryQueriesTab {...makeProps()} />, { wrapper: TestProvider });

    await waitFor(() => {
      expect(screen.queryByText('Loading results...')).not.toBeInTheDocument();
    });

    // A failing "bad" datasource must not take down the healthy one: its card resolves
    // and shows the datasource name rather than "Data source does not exist anymore".
    expect(await screen.findByLabelText('Data source name')).toHaveTextContent('good');
    expect(screen.queryByText('Data source does not exist anymore')).not.toBeInTheDocument();
  });
});
