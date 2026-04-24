import { PluginType } from '@grafana/data';
import { setTestFlags } from '@grafana/test-utils/unstable';

import { config } from '../../config';
import { type BackendSrv, setBackendSrv } from '../backendSrv';
import { setLogger } from '../logging/registry';

import { FALLBACK_TO_BOOTDATA_WARNING } from './constants';
import {
  getDatasourcePluginMeta,
  getDatasourcePluginMetas,
  refetchDatasourcePluginMetas,
  setDatasourcePluginMetas,
} from './datasources';
import { logPluginMetaWarning } from './logging';
import { initPluginMetas, refetchPluginMetas } from './plugins';
import { prometheusMeta } from './test-fixtures/config.datasources';
import { v0alpha1Response } from './test-fixtures/v0alpha1Response';

jest.mock('./plugins', () => ({
  ...jest.requireActual('./plugins'),
  initPluginMetas: jest.fn(),
  refetchPluginMetas: jest.fn(),
}));

jest.mock('./logging', () => ({
  logPluginMetaWarning: jest.fn(),
  logPluginMetaError: jest.fn(),
}));

const initPluginMetasMock = jest.mocked(initPluginMetas);
const refetchPluginMetasMock = jest.mocked(refetchPluginMetas);
const logPluginMetaWarningMock = jest.mocked(logPluginMetaWarning);

const datasourceItemsFromApi = v0alpha1Response.items.filter((i) => i.spec.pluginJson.type === 'datasource');
const datasourceIdsFromApi = datasourceItemsFromApi.map((i) => i.spec.pluginJson.id);

describe('when useMTPlugins flag is enabled', () => {
  beforeAll(() => {
    setTestFlags({ useMTPlugins: true });
    setLogger('grafana/runtime.plugins.settings', {
      logDebug: jest.fn(),
      logError: jest.fn(),
      logInfo: jest.fn(),
      logMeasurement: jest.fn(),
      logWarning: jest.fn(),
    });
  });

  afterAll(() => {
    setTestFlags({});
  });

  describe('and datasources is not initialized', () => {
    let consoleSpy: jest.SpyInstance;

    beforeEach(() => {
      setDatasourcePluginMetas({});
      jest.resetAllMocks();
      initPluginMetasMock.mockResolvedValue({ items: [] });
      consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it('getDatasourcePluginMetas should call initPluginMetas and return correct result', async () => {
      const result = await getDatasourcePluginMetas();

      expect(result).toEqual([]);
      expect(initPluginMetasMock).toHaveBeenCalledTimes(1);
    });

    it('getDatasourcePluginMeta should call initPluginMetas and return correct result', async () => {
      const result = await getDatasourcePluginMeta('prometheus');

      expect(result).toEqual(null);
      expect(initPluginMetasMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('and API returns non-empty items', () => {
    beforeEach(() => {
      setDatasourcePluginMetas({});
      jest.resetAllMocks();
      initPluginMetasMock.mockResolvedValue(v0alpha1Response);
    });

    it('getDatasourcePluginMetas should return metas mapped from the API response', async () => {
      const result = await getDatasourcePluginMetas();

      expect(result).toHaveLength(datasourceIdsFromApi.length);
      expect(result.map((m) => m.id).sort()).toEqual([...datasourceIdsFromApi].sort());
      expect(result.every((m) => m.type === PluginType.datasource)).toBe(true);
      expect(logPluginMetaWarningMock).not.toHaveBeenCalled();
    });

    it('getDatasourcePluginMeta should return the mapped meta for a known id', async () => {
      const knownId = datasourceIdsFromApi[0];
      const result = await getDatasourcePluginMeta(knownId);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(knownId);
      expect(result!.type).toBe(PluginType.datasource);
    });
  });

  describe('and datasources is initialized', () => {
    beforeEach(() => {
      setDatasourcePluginMetas({ prometheus: prometheusMeta });
      jest.resetAllMocks();
    });

    it('getDatasourcePluginMetas should not call initPluginMetas and return correct result', async () => {
      const result = await getDatasourcePluginMetas();

      expect(result).toEqual([prometheusMeta]);
      expect(initPluginMetasMock).not.toHaveBeenCalled();
    });

    it('getDatasourcePluginMeta should not call initPluginMetas and return correct result', async () => {
      const result = await getDatasourcePluginMeta('prometheus');

      expect(result).toEqual(prometheusMeta);
      expect(initPluginMetasMock).not.toHaveBeenCalled();
    });

    it('getDatasourcePluginMeta should return null if the pluginId is not found', async () => {
      const result = await getDatasourcePluginMeta('nonexistent-datasource');

      expect(result).toEqual(null);
    });

    it('getDatasourcePluginMeta should resolve a plugin by aliasIDs', async () => {
      const aliased = { ...prometheusMeta, aliasIDs: ['some-alias'] };
      setDatasourcePluginMetas({ 'aliased-datasource': aliased });

      const result = await getDatasourcePluginMeta('some-alias');

      expect(result).toEqual(aliased);
      expect(initPluginMetasMock).not.toHaveBeenCalled();
    });
  });

  describe('and refetchDatasourcePluginMetas is called', () => {
    let backendSrv: BackendSrv;
    let consoleSpy: jest.SpyInstance;

    beforeEach(() => {
      setDatasourcePluginMetas({});
      jest.resetAllMocks();
      refetchPluginMetasMock.mockResolvedValue({ items: [] });
      consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      backendSrv = {
        chunked: jest.fn(),
        delete: jest.fn(),
        fetch: jest.fn(),
        patch: jest.fn(),
        post: jest.fn(),
        put: jest.fn(),
        get: jest.fn().mockResolvedValue({ datasources: {} }),
        request: jest.fn(),
        datasourceRequest: jest.fn(),
      };
      setBackendSrv(backendSrv);
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it('should call refetchPluginMetas', async () => {
      await refetchDatasourcePluginMetas();

      expect(refetchPluginMetasMock).toHaveBeenCalledTimes(1);
      expect(backendSrv.get).not.toHaveBeenCalled();
    });
  });

  describe('and refetchDatasourcePluginMetas returns non-empty items', () => {
    beforeEach(() => {
      setDatasourcePluginMetas({});
      jest.resetAllMocks();
      refetchPluginMetasMock.mockResolvedValue(v0alpha1Response);
    });

    it('should populate metas from the mapped API response', async () => {
      await refetchDatasourcePluginMetas();
      const result = await getDatasourcePluginMetas();

      expect(result).toHaveLength(datasourceIdsFromApi.length);
      expect(result.map((m) => m.id).sort()).toEqual([...datasourceIdsFromApi].sort());
      expect(result.every((m) => m.type === PluginType.datasource)).toBe(true);
      expect(logPluginMetaWarningMock).not.toHaveBeenCalled();
    });
  });

  describe('and API returns empty items', () => {
    const originalConfigDatasources = config.datasources;

    beforeEach(() => {
      setDatasourcePluginMetas({});
      jest.resetAllMocks();
      initPluginMetasMock.mockResolvedValue({ items: [] });
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      config.datasources = {
        Prometheus: { type: 'prometheus', meta: prometheusMeta } as (typeof config.datasources)[string],
      };
    });

    afterEach(() => {
      config.datasources = originalConfigDatasources;
    });

    it('should fall back to bootdata when API returns empty', async () => {
      const result = await getDatasourcePluginMetas();

      expect(result).toEqual([prometheusMeta]);
      expect(initPluginMetasMock).toHaveBeenCalledTimes(1);
    });

    it('should log a warning when falling back to bootdata', async () => {
      await getDatasourcePluginMetas();

      expect(logPluginMetaWarningMock).toHaveBeenCalledTimes(1);
      expect(logPluginMetaWarningMock).toHaveBeenCalledWith(FALLBACK_TO_BOOTDATA_WARNING, PluginType.datasource);
    });
  });
});

describe('when useMTPlugins flag is disabled', () => {
  beforeAll(() => {
    setTestFlags({ useMTPlugins: false });
  });

  afterAll(() => {
    setTestFlags({});
  });

  describe('and datasources is not initialized', () => {
    beforeEach(() => {
      setDatasourcePluginMetas({});
      jest.resetAllMocks();
    });

    it('getDatasourcePluginMetas should not call initPluginMetas and return correct result', async () => {
      const result = await getDatasourcePluginMetas();

      expect(result).toEqual([]);
      expect(initPluginMetasMock).not.toHaveBeenCalled();
    });

    it('getDatasourcePluginMeta should not call initPluginMetas and return correct result', async () => {
      const result = await getDatasourcePluginMeta('prometheus');

      expect(result).toEqual(null);
      expect(initPluginMetasMock).not.toHaveBeenCalled();
    });
  });

  describe('and datasources is initialized', () => {
    beforeEach(() => {
      setDatasourcePluginMetas({ prometheus: prometheusMeta });
      jest.resetAllMocks();
    });

    it('getDatasourcePluginMetas should not call initPluginMetas and return correct result', async () => {
      const result = await getDatasourcePluginMetas();

      expect(result).toEqual([prometheusMeta]);
      expect(initPluginMetasMock).not.toHaveBeenCalled();
    });

    it('getDatasourcePluginMeta should not call initPluginMetas and return correct result', async () => {
      const result = await getDatasourcePluginMeta('prometheus');

      expect(result).toEqual(prometheusMeta);
      expect(initPluginMetasMock).not.toHaveBeenCalled();
    });

    it('getDatasourcePluginMeta should return null if the pluginId is not found', async () => {
      const result = await getDatasourcePluginMeta('nonexistent-datasource');

      expect(result).toEqual(null);
    });
  });

  describe('when refetchDatasourcePluginMetas is called', () => {
    let backendSrv: BackendSrv;
    beforeEach(() => {
      setDatasourcePluginMetas({});
      jest.resetAllMocks();
      refetchPluginMetasMock.mockResolvedValue({ items: [] });
      backendSrv = {
        chunked: jest.fn(),
        delete: jest.fn(),
        fetch: jest.fn(),
        patch: jest.fn(),
        post: jest.fn(),
        put: jest.fn(),
        get: jest.fn().mockResolvedValue({
          datasources: {
            'Prometheus-1': { type: 'prometheus', meta: prometheusMeta },
            'Prometheus-2': { type: 'prometheus', meta: prometheusMeta },
          },
        }),
        request: jest.fn(),
        datasourceRequest: jest.fn(),
      };
      setBackendSrv(backendSrv);
    });

    it('should call /api/frontend/settings', async () => {
      await refetchDatasourcePluginMetas();

      expect(backendSrv.get).toHaveBeenCalledTimes(1);
      expect(backendSrv.get).toHaveBeenCalledWith('/api/frontend/settings');
      expect(refetchPluginMetasMock).not.toHaveBeenCalled();
    });

    it('should deduplicate metas by plugin type', async () => {
      await refetchDatasourcePluginMetas();

      const result = await getDatasourcePluginMetas();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('prometheus');
    });

    it('should use passed-in settings without calling /api/frontend/settings', async () => {
      await refetchDatasourcePluginMetas({
        datasources: {
          Prometheus: { type: 'prometheus', meta: prometheusMeta },
        },
      });

      const result = await getDatasourcePluginMetas();

      expect(backendSrv.get).not.toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('prometheus');
    });
  });
});

describe('immutability', () => {
  beforeEach(() => {
    setDatasourcePluginMetas({ prometheus: prometheusMeta });
    jest.resetAllMocks();
  });

  it('getDatasourcePluginMetas should return a deep clone', async () => {
    const mutated = await getDatasourcePluginMetas();

    expect(mutated).toHaveLength(1);
    expect(mutated[0].info.author.name).toEqual('Grafana Labs');

    mutated[0].info.author.name = '';

    const result = await getDatasourcePluginMetas();
    expect(result[0].info.author.name).toEqual('Grafana Labs');
  });

  it('getDatasourcePluginMeta should return a deep clone', async () => {
    const mutated = await getDatasourcePluginMeta('prometheus');

    expect(mutated).toBeDefined();
    expect(mutated!.info.author.name).toEqual('Grafana Labs');

    mutated!.info.author.name = '';

    const result = await getDatasourcePluginMeta('prometheus');
    expect(result).toBeDefined();
    expect(result!.info.author.name).toEqual('Grafana Labs');
  });
});
