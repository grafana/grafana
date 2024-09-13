import { config } from '@grafana/runtime';

import { scopesSelectorScene } from '../instance';

import { getDatasource, getInstanceSettings, getMock } from './utils/mocks';
import { renderDashboard } from './utils/render';

jest.mock('@grafana/runtime', () => ({
  __esModule: true,
  ...jest.requireActual('@grafana/runtime'),
  useChromeHeaderHeight: jest.fn(),
  getBackendSrv: () => ({ get: getMock }),
  getDataSourceSrv: () => ({ get: getDatasource, getInstanceSettings }),
  usePluginLinks: jest.fn().mockReturnValue({ links: [] }),
}));

describe('Feature flag off', () => {
  beforeAll(() => {
    config.featureToggles.scopeFilters = false;
    config.featureToggles.groupByVariable = true;
  });

  it('Does not initialize', () => {
    renderDashboard();
    expect(scopesSelectorScene).toBeNull();
  });
});
