import { configureStore } from 'app/store/configureStore';

import { supportedFeatures } from '../../../core/history/richHistoryStorageProvider';
import { SortOrder } from '../../../core/utils/richHistoryTypes';

import { updateHistorySearchFilters } from './history';

jest.mock('app/core/utils/richHistory', () => ({
  ...jest.requireActual('app/core/utils/richHistory'),
  updateRichHistorySettings: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../core/history/richHistoryStorageProvider', () => ({
  ...jest.requireActual('../../../core/history/richHistoryStorageProvider'),
  supportedFeatures: jest.fn(),
}));

const { updateRichHistorySettings } = jest.requireMock('app/core/utils/richHistory');

const baseSettings = {
  retentionPeriod: 7,
  starredTabAsFirstTab: false,
  activeDatasourcesOnly: false,
  lastUsedDatasourceFilters: ['prometheus'],
};

const baseFilters = {
  search: '',
  sortOrder: SortOrder.Descending,
  datasourceFilters: ['loki'],
  from: 0,
  to: 7,
  starred: false,
};

function setup(activeDatasourcesOnly: boolean) {
  (supportedFeatures as jest.Mock).mockReturnValue({ lastUsedDataSourcesAvailable: true });
  const store = configureStore({
    explore: { richHistorySettings: { ...baseSettings, activeDatasourcesOnly } },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  return store;
}

describe('updateHistorySearchFilters', () => {
  beforeEach(() => jest.clearAllMocks());

  it('does not persist lastUsedDatasourceFilters when activeDatasourcesOnly is on', async () => {
    const store = setup(true);
    await store.dispatch(updateHistorySearchFilters(baseFilters));
    expect(updateRichHistorySettings).not.toHaveBeenCalled();
  });

  it('persists lastUsedDatasourceFilters when activeDatasourcesOnly is off', async () => {
    const store = setup(false);
    await store.dispatch(updateHistorySearchFilters(baseFilters));
    expect(updateRichHistorySettings).toHaveBeenCalledWith(
      expect.objectContaining({ lastUsedDatasourceFilters: ['loki'] })
    );
  });
});
