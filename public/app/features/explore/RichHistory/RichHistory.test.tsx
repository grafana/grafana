import { render, screen } from '@testing-library/react';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { SortOrder } from 'app/core/utils/richHistory';

import { ExploreId } from '../../../types/explore';

import { RichHistory, RichHistoryProps, Tabs } from './RichHistory';

jest.mock('../state/selectors', () => ({ getExploreDatasources: jest.fn() }));

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

const setup = (propOverrides?: Partial<RichHistoryProps>) => {
  const props: RichHistoryProps = {
    theme: {} as GrafanaTheme2,
    exploreId: ExploreId.left,
    height: 100,
    activeDatasourceInstance: 'Test datasource',
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
      activeDatasourceOnly: true,
      lastUsedDatasourceFilters: [],
    },
    updateHistorySearchFilters: jest.fn(),
    updateHistorySettings: jest.fn(),
  };

  Object.assign(props, propOverrides);

  render(<RichHistory {...props} />);
};

describe('RichHistory', () => {
  it('should render tabs as defined', () => {
    setup();
    const tabs = screen.getAllByLabelText(/Tab*/);
    expect(tabs).toHaveLength(3);
    expect(tabs[0]).toHaveTextContent('Query history');
    expect(tabs[1]).toHaveTextContent('Starred');
    expect(tabs[2]).toHaveTextContent('Settings');
  });

  it('should render defined default', () => {
    setup();
    const tabs = screen.getAllByLabelText(/Tab*/);
    expect(tabs[0].className).toMatch(/-*activeTabStyle/);
    expect(tabs[1].className).not.toMatch(/-*activeTabStyle/);
  });
});
