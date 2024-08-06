import { render } from '@testing-library/react';
import { TestProvider } from 'test/helpers/TestProvider';

import { SortOrder } from 'app/core/utils/richHistory';

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

jest.mock('react-use', () => ({
  ...jest.requireActual('react-use'),
  useAsync: () => ({ loading: false, value: [] }),
}));

jest.mock('../state/selectors', () => ({ selectExploreDSMaps: jest.fn().mockReturnValue({ dsToExplore: [] }) }));

const setup = (propOverrides?: Partial<Props>) => {
  const props: Props = {
    richHistory: [],
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
  it('should re-request rich history every time the component is mounted', () => {
    const initRichHistory = jest.fn();
    const { unmount } = setup({ initRichHistory });
    expect(initRichHistory).toHaveBeenCalledTimes(1);

    unmount();
    expect(initRichHistory).toHaveBeenCalledTimes(1);

    setup({ initRichHistory });
    expect(initRichHistory).toHaveBeenCalledTimes(2);
  });
});
