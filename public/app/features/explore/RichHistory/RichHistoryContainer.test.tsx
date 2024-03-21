import { render } from '@testing-library/react';
import React from 'react';
import { TestProvider } from 'test/helpers/TestProvider';

import { SortOrder } from 'app/core/utils/richHistory';

import { Tabs } from './RichHistory';
import { RichHistoryContainer, Props } from './RichHistoryContainer';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => {
    return {
      getList: () => [],
    };
  },
  reportInteraction: jest.fn(),
}));

jest.mock('../state/selectors', () => ({ selectExploreDSMaps: jest.fn().mockReturnValue({ dsToExplore: [] }) }));

const setup = (propOverrides?: Partial<Props>) => {
  const props: Props = {
    richHistory: [],
    firstTab: Tabs.RichHistory,
    deleteRichHistory: jest.fn(),
    initRichHistory: jest.fn(),
    loadRichHistory: jest.fn(),
    loadMoreRichHistory: jest.fn(),
    clearRichHistoryResults: jest.fn(),
    updateHistorySearchFilters: jest.fn(),
    updateHistorySettings: jest.fn(),
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
    richHistoryTotal: 0,
  };

  Object.assign(props, propOverrides);

  return render(<RichHistoryContainer {...props} />, { wrapper: TestProvider });
};

describe('RichHistoryContainer', () => {
  it('should show loading message when settings are not ready', () => {
    const { container } = setup({ richHistorySettings: undefined });
    expect(container).toHaveTextContent('Loading...');
  });
  it('should render component with correct width', () => {
    const { container } = setup();
    expect(container.firstElementChild!.getAttribute('style')).toContain('width: 531.5px');
  });
  it('should render component with correct height', () => {
    const { container } = setup();
    expect(container.firstElementChild!.getAttribute('style')).toContain('height: 400px');
  });
  it('should re-request rich history every time the component is mounted', () => {
    const initRichHistory = jest.fn();
    const { unmount } = setup({ initRichHistory });
    expect(initRichHistory).toBeCalledTimes(1);

    unmount();
    expect(initRichHistory).toBeCalledTimes(1);

    setup({ initRichHistory });
    expect(initRichHistory).toBeCalledTimes(2);
  });
});
