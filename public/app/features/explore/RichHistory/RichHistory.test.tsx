import { render, screen } from '@testing-library/react';
import { TestProvider } from 'test/helpers/TestProvider';

import { SortOrder } from 'app/core/utils/richHistory';

import { Tabs } from '../QueriesDrawer/QueriesDrawerContext';

import { RichHistory, RichHistoryProps } from './RichHistory';

jest.mock('../state/selectors', () => ({ selectExploreDSMaps: jest.fn().mockReturnValue({ dsToExplore: [] }) }));

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
    loadRichHistory: jest.fn(),
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
});
