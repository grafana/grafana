import { setTestFlags } from '@grafana/test-utils/unstable';

import { type BackendSrv, setBackendSrv } from '../backendSrv';

import {
  getDatasourcePluginMeta,
  getDatasourcePluginMetas,
  getDatasourcePluginMetasMap,
  getDatasourcePluginMetasMapSync,
  refetchDatasourcePluginMetas,
  setDatasourcePluginMetas,
} from './datasources';
import { initPluginMetas, refetchPluginMetas } from './plugins';
import { prometheusMeta } from './test-fixtures/config.datasources';

jest.mock('./plugins', () => ({
  ...jest.requireActual('./plugins'),
  initPluginMetas: jest.fn(),
  refetchPluginMetas: jest.fn(),
}));

const initPluginMetasMock = jest.mocked(initPluginMetas);
const refetchPluginMetasMock = jest.mocked(refetchPluginMetas);

describe('when useMTPlugins flag is enabled', () => {
  beforeAll(() => {
    setTestFlags({ useMTPlugins: true });
  });

  afterAll(() => {
    setTestFlags({});
  });

  describe('and datasources is not initialized', () => {
    beforeEach(() => {
      setDatasourcePluginMetas({});
      jest.resetAllMocks();
      initPluginMetasMock.mockResolvedValue({ items: [] });
    });

    it('getDatasourcePluginMetas should call initPluginMetas and return correct result', async () => {
      const result = await getDatasourcePluginMetas();

      expect(result).toEqual([]);
      expect(initPluginMetasMock).toHaveBeenCalledTimes(1);
    });

    it('getDatasourcePluginMetasMap should call initPluginMetas and return correct result', async () => {
      const result = await getDatasourcePluginMetasMap();

      expect(result).toEqual({});
      expect(initPluginMetasMock).toHaveBeenCalledTimes(1);
    });

    it('getDatasourcePluginMetasMapSync should return empty map', () => {
      const result = getDatasourcePluginMetasMapSync();

      expect(result).toEqual({});
      expect(initPluginMetasMock).not.toHaveBeenCalled();
    });

    describe('when process is under development', () => {
      let originalNodeEnv = process.env.NODE_ENV;
      beforeEach(() => {
        process.env.NODE_ENV = 'development';
      });

      afterEach(() => {
        process.env.NODE_ENV = originalNodeEnv;
      });

      it('getDatasourcePluginMetasMapSync should throw', () => {
        expect(() => getDatasourcePluginMetasMapSync()).toThrow(
          new Error('getDatasourcePluginMetasMapSync() was called before datasource plugins map was initialized!')
        );
        expect(initPluginMetasMock).not.toHaveBeenCalled();
      });
    });

    it('getDatasourcePluginMeta should call initPluginMetas and return correct result', async () => {
      const result = await getDatasourcePluginMeta('prometheus');

      expect(result).toEqual(null);
      expect(initPluginMetasMock).toHaveBeenCalledTimes(1);
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

    it('getDatasourcePluginMetasMap should not call initPluginMetas and return correct result', async () => {
      const result = await getDatasourcePluginMetasMap();

      expect(result).toEqual({ prometheus: prometheusMeta });
      expect(initPluginMetasMock).not.toHaveBeenCalled();
    });

    it('getDatasourcePluginMetasMapSync should return correct result', () => {
      const result = getDatasourcePluginMetasMapSync();

      expect(result).toEqual({ prometheus: prometheusMeta });
      expect(initPluginMetasMock).not.toHaveBeenCalled();
    });

    describe('when process is under development', () => {
      let originalNodeEnv = process.env.NODE_ENV;
      beforeEach(() => {
        process.env.NODE_ENV = 'development';
      });

      afterEach(() => {
        process.env.NODE_ENV = originalNodeEnv;
      });

      it('getDatasourcePluginMetasMapSync should not throw', () => {
        const result = getDatasourcePluginMetasMapSync();

        expect(result).toEqual({ prometheus: prometheusMeta });
        expect(initPluginMetasMock).not.toHaveBeenCalled();
      });
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

  describe('and refetchDatasourcePluginMetas is called', () => {
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
        get: jest.fn().mockResolvedValue({ datasources: {} }),
        request: jest.fn(),
        datasourceRequest: jest.fn(),
      };
      setBackendSrv(backendSrv);
    });

    it('should call refetchPluginMetas', async () => {
      await refetchDatasourcePluginMetas();

      expect(refetchPluginMetasMock).toHaveBeenCalledTimes(1);
      expect(backendSrv.get).not.toHaveBeenCalled();
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

    it('getDatasourcePluginMetasMap should not call initPluginMetas and return correct result', async () => {
      const result = await getDatasourcePluginMetasMap();

      expect(result).toEqual({});
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

    it('getDatasourcePluginMetasMap should not call initPluginMetas and return correct result', async () => {
      const result = await getDatasourcePluginMetasMap();

      expect(result).toEqual({ prometheus: prometheusMeta });
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

  it('getDatasourcePluginMetasMap should return a deep clone', async () => {
    const mutated = await getDatasourcePluginMetasMap();

    expect(mutated['prometheus'].info.author.name).toEqual('Grafana Labs');

    mutated['prometheus'].info.author.name = '';

    const result = await getDatasourcePluginMetasMap();
    expect(result['prometheus'].info.author.name).toEqual('Grafana Labs');
  });

  it('getDatasourcePluginMetasMapSync should return a deep clone', () => {
    const mutated = getDatasourcePluginMetasMapSync();

    expect(mutated['prometheus'].info.author.name).toEqual('Grafana Labs');

    mutated['prometheus'].info.author.name = '';

    const result = getDatasourcePluginMetasMapSync();
    expect(result['prometheus'].info.author.name).toEqual('Grafana Labs');
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
