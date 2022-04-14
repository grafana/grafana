import React from 'react';
import { render, screen } from '@testing-library/react';
import { GrafanaTheme } from '@grafana/data';
import { ExploreId } from '../../../types/explore';
import { RichHistory, RichHistoryProps, Tabs } from './RichHistory';
import { SortOrder } from '../../../core/utils/richHistoryTypes';

jest.mock('../state/selectors', () => ({ getExploreDatasources: jest.fn() }));

const setup = (propOverrides?: Partial<RichHistoryProps>) => {
  const props: RichHistoryProps = {
    theme: {} as GrafanaTheme,
    exploreId: ExploreId.left,
    height: 100,
    activeDatasourceInstance: 'Test datasource',
    richHistory: [],
    firstTab: Tabs.RichHistory,
    deleteRichHistory: jest.fn(),
    onClose: jest.fn(),
    richHistorySearchFilters: {
      search: '',
      sortOrder: SortOrder.Descending,
      datasourceFilters: [],
      from: 0,
      to: 7,
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
