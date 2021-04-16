import { lastUsedDatasourceKeyForOrgId } from '../../../core/utils/explore';

const dataSourceMock = {
  get: jest.fn(),
};
jest.mock('app/features/plugins/datasource_srv', () => ({
  getDatasourceSrv: jest.fn(() => dataSourceMock),
}));

const storeMock = {
  getObject: jest.fn().mockReturnValue([]),
  set: jest.fn(),
};
jest.mock('app/core/store', () => storeMock);

import { loadAndInitDatasource } from './utils';

const DEFAULT_DATASOURCE = { uid: 'abc123', name: 'Default' };
const TEST_DATASOURCE = { uid: 'def789', name: 'Test' };

describe('loadAndInitDatasource', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('falls back to default datasource if the provided one was not found', async () => {
    dataSourceMock.get.mockRejectedValueOnce(new Error('Datasource not found'));
    dataSourceMock.get.mockResolvedValue(DEFAULT_DATASOURCE);

    const { instance } = await loadAndInitDatasource(1, 'Unknown');

    expect(dataSourceMock.get).toBeCalledTimes(2);
    expect(dataSourceMock.get).toBeCalledWith('Unknown');
    expect(dataSourceMock.get).toBeCalledWith();
    expect(instance).toMatchObject(DEFAULT_DATASOURCE);
    expect(storeMock.set).toBeCalledWith(lastUsedDatasourceKeyForOrgId(1), DEFAULT_DATASOURCE.uid);
  });

  it('saves last loaded data source uid', async () => {
    dataSourceMock.get.mockResolvedValue(TEST_DATASOURCE);

    const { instance } = await loadAndInitDatasource(1, 'Test');

    expect(dataSourceMock.get).toBeCalledTimes(1);
    expect(dataSourceMock.get).toBeCalledWith('Test');
    expect(instance).toMatchObject(TEST_DATASOURCE);
    expect(storeMock.set).toBeCalledWith(lastUsedDatasourceKeyForOrgId(1), TEST_DATASOURCE.uid);
  });
});
