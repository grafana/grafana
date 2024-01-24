import {
  updateDashboardUidLastUsedDatasource,
  getLastUsedDatasourceFromStorage,
  initLastUsedDatasourceKeyForDashboard,
  setLastUsedDatasourceKeyForDashboard,
} from './dashboard'; // Replace with the path to your actual module

// Mock the store module
jest.mock('app/core/store', () => ({
  exists: jest.fn(),
  getObject: jest.fn((_a, b) => b),
  setObject: jest.fn(),
  get: jest.fn(),
}));

const store = jest.requireMock('app/core/store');

describe('Last Used Datasource Local Storage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should retrieve the last used datasource', () => {
    store.exists.mockReturnValue(true);
    store.getObject.mockReturnValue({
      dashboardUid: '123',
      datasourceUid: 'datasource1',
    });

    const result = getLastUsedDatasourceFromStorage('123');
    expect(result).toEqual({ dashboardUid: '123', datasourceUid: 'datasource1' });
  });

  it('should update only the dashboard UID', () => {
    store.exists.mockReturnValue(true);
    store.getObject.mockReturnValue({
      dashboardUid: '456',
      datasourceUid: 'datasource2',
    });

    updateDashboardUidLastUsedDatasource('789');
    expect(store.setObject).toHaveBeenCalledWith('grafana.dashboards.panelEdit.lastUsedDatasource', {
      dashboardUid: '789',
      datasourceUid: 'datasource2',
    });
  });

  it('should initialize local storage for a dashboard with empty datasource UID', () => {
    initLastUsedDatasourceKeyForDashboard('999');
    expect(store.setObject).toHaveBeenCalledWith('grafana.dashboards.panelEdit.lastUsedDatasource', {
      dashboardUid: '999',
      datasourceUid: '',
    });
  });

  it('should set a new datasource UID and dashboard UID for a dashboard', () => {
    store.exists.mockReturnValue(false);

    setLastUsedDatasourceKeyForDashboard('111', 'datasource3');
    expect(store.setObject).toHaveBeenCalledWith('grafana.dashboards.panelEdit.lastUsedDatasource', {
      dashboardUid: '111',
      datasourceUid: 'datasource3',
    });
  });

  it('should update the datasource UID while keeping the existing dashboard UID', () => {
    store.exists.mockReturnValue(true);
    store.getObject.mockReturnValue({
      dashboardUid: '222',
      datasourceUid: 'datasource4',
    });

    setLastUsedDatasourceKeyForDashboard('222', 'datasource5');
    expect(store.setObject).toHaveBeenCalledWith('grafana.dashboards.panelEdit.lastUsedDatasource', {
      dashboardUid: '222',
      datasourceUid: 'datasource5',
    });
  });
});
