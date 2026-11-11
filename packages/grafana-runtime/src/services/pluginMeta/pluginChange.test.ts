import { setTestFlags } from '@grafana/test-utils/unstable';

import { FlagKeys } from '../../internal/openFeature/openfeature.gen';
import { type BackendSrv, setBackendSrv } from '../backendSrv';

import { getDatasourcePluginMetas, setDatasourcePluginMetas } from './datasources';
import { getPanelPluginMetas, setPanelPluginMetas } from './panels';
import { refetchPluginMetasAfterPluginChange } from './pluginChange';
import { refetchPluginMetas } from './plugins';
import { prometheusMeta } from './test-fixtures/config.datasources';
import { panel } from './test-fixtures/config.panels';
import { v0alpha1Response } from './test-fixtures/v0alpha1Response';

jest.mock('./plugins', () => ({
  ...jest.requireActual('./plugins'),
  initPluginMetas: jest.fn(),
  refetchPluginMetas: jest.fn(),
}));

jest.mock('./logging', () => ({
  logPluginMetaWarning: jest.fn(),
  logPluginMetaError: jest.fn(),
  logPluginMetaDebug: jest.fn(),
}));

const refetchPluginMetasMock = jest.mocked(refetchPluginMetas);
const backendGet = jest.fn();

beforeAll(() => {
  setBackendSrv({ get: backendGet } as unknown as BackendSrv);
});

beforeEach(() => {
  jest.resetAllMocks();
  setPanelPluginMetas({});
  setDatasourcePluginMetas({});
});

afterEach(() => {
  setTestFlags({});
});

describe('refetchPluginMetasAfterPluginChange', () => {
  it('sets the panel and data source metas from the payload without a request when MT plugins are off', async () => {
    await refetchPluginMetasAfterPluginChange({
      panels: { [panel.id]: panel },
      datasources: { Prometheus: { type: 'prometheus', meta: prometheusMeta } },
    });

    expect(await getPanelPluginMetas()).toEqual([panel]);
    expect(await getDatasourcePluginMetas()).toEqual([prometheusMeta]);
    expect(backendGet).not.toHaveBeenCalled();
    expect(refetchPluginMetasMock).not.toHaveBeenCalled();
  });

  it('serves the panel and data source metas from one MT request when MT plugins are on', async () => {
    setTestFlags({ [FlagKeys.PluginsUseMTPlugins]: true });
    refetchPluginMetasMock.mockResolvedValue(v0alpha1Response);

    await refetchPluginMetasAfterPluginChange({ panels: {}, datasources: {} });

    const types = (items: Array<{ type: string }>) => new Set(items.map((item) => item.type));
    expect(types(await getPanelPluginMetas())).toEqual(new Set(['panel']));
    expect(types(await getDatasourcePluginMetas())).toEqual(new Set(['datasource']));
    expect(refetchPluginMetasMock).toHaveBeenCalledTimes(1);
    expect(backendGet).not.toHaveBeenCalled();
  });
});
