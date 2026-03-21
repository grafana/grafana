import { DatasourceSrv } from '../../features/plugins/datasource_srv';

const dsMock = new DatasourceSrv();
dsMock.init(
  {
    // @ts-ignore
    'name-of-ds1': { uid: 'ds1', name: 'name-of-ds1' },
  },
  ''
);

const fetchMock = jest.fn();
const postMock = jest.fn();
const getMock = jest.fn();
const putMock = jest.fn();
const deleteMock = jest.fn();
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => ({
    fetch: fetchMock,
    post: postMock,
    get: getMock,
    put: putMock,
    delete: deleteMock,
  }),
  getDataSourceSrv: () => dsMock,
  config: {
    namespace: 'default',
  },
}));

const preferencesServiceMock = {
  patch: jest.fn(),
  load: jest.fn(),
};
jest.mock('../services/PreferencesService', () => ({
  PreferencesService: function () {
    return preferencesServiceMock;
  },
}));

// FIXME: Tests break unless plugin loader is mocked. This is likely due to a circular dependency
jest.mock('app/features/plugins/importer/pluginImporter', () => ({}));

import RichHistoryAppPlatformStorage from './RichHistoryAppPlatformStorage';

describe('RichHistoryAppPlatformStorage', () => {
  let storage: RichHistoryAppPlatformStorage;

  beforeEach(() => {
    storage = new RichHistoryAppPlatformStorage();
    jest.clearAllMocks();
  });

  it('should implement RichHistoryStorage interface', () => {
    expect(storage.addToRichHistory).toBeDefined();
    expect(storage.deleteRichHistory).toBeDefined();
    expect(storage.getRichHistory).toBeDefined();
    expect(storage.updateComment).toBeDefined();
    expect(storage.updateStarred).toBeDefined();
    expect(storage.getSettings).toBeDefined();
    expect(storage.updateSettings).toBeDefined();
    expect(storage.deleteAll).toBeDefined();
  });

  it('should throw on deleteAll', async () => {
    await expect(storage.deleteAll()).rejects.toThrow('not supported');
  });

  it('should load settings from preferences', async () => {
    preferencesServiceMock.load.mockResolvedValue({
      queryHistory: { homeTab: 'starred' },
    });

    const settings = await storage.getSettings();
    expect(settings.starredTabAsFirstTab).toBe(true);
    expect(settings.retentionPeriod).toBe(14);
  });
});
