import { setTestFlags } from '@grafana/test-utils/unstable';

import { type BackendSrv, setBackendSrv } from '../backendSrv';
import { getLogger, setLogger } from '../logging/registry';

import {
  getListedPanelPluginIds,
  getListedPanelPluginMetas,
  getPanelPluginMeta,
  getPanelPluginMetas,
  getPanelPluginMetasMap,
  getPanelPluginMetasMapSync,
  getPanelPluginVersion,
  isPanelPluginInstalled,
  refetchPanelPluginMetas,
  setPanelPluginMetas,
} from './panels';
import { initPluginMetas, refetchPluginMetas } from './plugins';
import { panel, panels as testPanels } from './test-fixtures/config.panels';
import { v0alpha1Response } from './test-fixtures/v0alpha1Response';

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

  describe('and panels is not initialized', () => {
    beforeEach(() => {
      setPanelPluginMetas({});
      jest.resetAllMocks();
      initPluginMetasMock.mockResolvedValue({ items: [v0alpha1Response.items[0]] });
    });

    it('getPanelPluginMetas should call initPluginMetas and return correct result', async () => {
      const panels = await getPanelPluginMetas();

      expect(panels).toMatchObject([testPanels.alertlist]);
      expect(initPluginMetasMock).toHaveBeenCalledTimes(1);
    });

    it('getListedPanelPluginMetas should call initPluginMetas and return correct result', async () => {
      const panels = await getListedPanelPluginMetas();

      expect(panels).toMatchObject([testPanels.alertlist]);
      expect(initPluginMetasMock).toHaveBeenCalledTimes(1);
    });

    it('getPanelPluginMetasMap should call initPluginMetas and return correct result', async () => {
      const panels = await getPanelPluginMetasMap();

      expect(panels).toMatchObject({ alertlist: testPanels.alertlist });
      expect(initPluginMetasMock).toHaveBeenCalledTimes(1);
    });

    it('getPanelPluginMetasMapSync should return empty map', () => {
      const panels = getPanelPluginMetasMapSync();

      expect(panels).toEqual({});
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

      it('getPanelPluginMetasMapSync should throw', () => {
        expect(() => getPanelPluginMetasMapSync()).toThrow(
          new Error('getPanelPluginMetasMapSync() was called before panel plugins map was initialized!')
        );
        expect(initPluginMetasMock).not.toHaveBeenCalled();
      });
    });

    it('getPanelPluginMeta should call initPluginMetas and return correct result', async () => {
      const result = await getPanelPluginMeta('alertlist');

      expect(result).toMatchObject(testPanels.alertlist);
      expect(initPluginMetasMock).toHaveBeenCalledTimes(1);
    });

    it('isPanelPluginInstalled should call initPluginMetas and return true if the panel exists', async () => {
      const installed = await isPanelPluginInstalled('alertlist');

      expect(installed).toEqual(true);
      expect(initPluginMetasMock).toHaveBeenCalledTimes(1);
    });

    it('isPanelPluginInstalled should call initPluginMetas and return false if the panel does not exist', async () => {
      const installed = await isPanelPluginInstalled('grafana-test-panel');

      expect(installed).toEqual(false);
      expect(initPluginMetasMock).toHaveBeenCalledTimes(1);
    });

    it('getPanelPluginVersion should call initPluginMetas and return correct verstion if the panel exists', async () => {
      const result = await getPanelPluginVersion('alertlist');

      expect(result).toEqual('');
      expect(initPluginMetasMock).toHaveBeenCalledTimes(1);
    });

    it('getPanelPluginVersion should call initPluginMetas and return null if the panel does not exist', async () => {
      const result = await getPanelPluginVersion('grafana-test-panel');

      expect(result).toEqual(null);
      expect(initPluginMetasMock).toHaveBeenCalledTimes(1);
    });

    it('getListedPanelPluginIds should call initPluginMetas and return a correct array', async () => {
      const installed = await getListedPanelPluginIds();

      expect(installed).toEqual(['alertlist']);
      expect(initPluginMetasMock).toHaveBeenCalledTimes(1);
    });

    describe('and initPluginMetas or refetchPanelPluginMetas returns an empty result', () => {
      beforeEach(() => {
        jest.resetAllMocks();
        // can't use mockLogger here because that would cause a circular dependency between @grafana/runtime and @grafana/test-utils
        setLogger('grafana/runtime.plugins.meta', {
          logDebug: jest.fn(),
          logError: jest.fn(),
          logInfo: jest.fn(),
          logMeasurement: jest.fn(),
          logWarning: jest.fn(),
        });
        initPluginMetasMock.mockResolvedValue({ items: [] });
        refetchPluginMetasMock.mockResolvedValue({ items: [] });
      });

      it.each([
        { func: getPanelPluginMetas },
        { func: getListedPanelPluginMetas },
        { func: getPanelPluginMetasMap },
        { func: getListedPanelPluginIds },
        { func: refetchPanelPluginMetas },
      ])(`when func:$func is called then a warning should be logged`, async ({ func }) => {
        await func();

        expect(getLogger('grafana/runtime.plugins.meta').logWarning).toHaveBeenCalledTimes(1);
        expect(getLogger('grafana/runtime.plugins.meta').logWarning).toHaveBeenCalledWith(
          'PluginMeta: plugin meta yielded an empty result so Grafana is falling back to bootdata',
          { type: 'panel' }
        );
      });

      it.each([{ func: getPanelPluginMeta }, { func: isPanelPluginInstalled }, { func: getPanelPluginVersion }])(
        `when func:$func is called then a warning should be logged`,
        async ({ func }) => {
          await func('');

          expect(getLogger('grafana/runtime.plugins.meta').logWarning).toHaveBeenCalledTimes(1);
          expect(getLogger('grafana/runtime.plugins.meta').logWarning).toHaveBeenCalledWith(
            'PluginMeta: plugin meta yielded an empty result so Grafana is falling back to bootdata',
            { type: 'panel' }
          );
        }
      );
    });
  });

  describe('and panels is initialized', () => {
    beforeEach(() => {
      setPanelPluginMetas({ 'grafana-test-panel': panel });
      jest.resetAllMocks();
    });

    it('getPanelPluginMetas should not call initPluginMetas and return correct result', async () => {
      const panels = await getPanelPluginMetas();

      expect(panels).toEqual([panel]);
      expect(initPluginMetasMock).not.toHaveBeenCalled();
    });

    it('getListedPanelPluginMetas should not call initPluginMetas and return correct result', async () => {
      setPanelPluginMetas({
        'grafana-test-panel': panel,
        'grafana-hidden-panel': { ...panel, id: 'grafana-hidden-panel', hideFromList: true },
        'grafana-sorted-first-panel': { ...panel, id: 'grafana-sorted-first-panel', sort: 10 },
      });
      const panels = await getListedPanelPluginMetas();

      expect(panels).toEqual([{ ...panel, id: 'grafana-sorted-first-panel', sort: 10 }, panel]);
      expect(initPluginMetasMock).not.toHaveBeenCalled();
    });

    it('getPanelPluginMetasMap should not call initPluginMetas and return correct result', async () => {
      const panels = await getPanelPluginMetasMap();

      expect(panels).toEqual({ 'grafana-test-panel': panel });
      expect(initPluginMetasMock).not.toHaveBeenCalled();
    });

    it('getPanelPluginMetasMapSync should return correct result', () => {
      const panels = getPanelPluginMetasMapSync();

      expect(panels).toEqual({ 'grafana-test-panel': panel });
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

      it('getPanelPluginMetasMapSync should not throw', () => {
        const panels = getPanelPluginMetasMapSync();

        expect(panels).toEqual({ 'grafana-test-panel': panel });
        expect(initPluginMetasMock).not.toHaveBeenCalled();
      });
    });

    it('getPanelPluginMeta should not call initPluginMetas and return correct result', async () => {
      const result = await getPanelPluginMeta('grafana-test-panel');

      expect(result).toEqual(panel);
      expect(initPluginMetasMock).not.toHaveBeenCalled();
    });

    it('getPanelPluginMeta should not call initPluginMetas and return correct result for correct aliasIDs', async () => {
      const aliased = { ...panel, aliasIDs: ['some-alias'] };
      setPanelPluginMetas({ 'aliased-test-panel': aliased });

      const result = await getPanelPluginMeta('some-alias');

      expect(result).toEqual(aliased);
      expect(initPluginMetasMock).not.toHaveBeenCalled();
    });

    it('getPanelPluginMeta should return null if the pluginId is not found', async () => {
      const result = await getPanelPluginMeta('otherorg-otherplugin-panel');

      expect(result).toEqual(null);
    });

    it('isPanelPluginInstalled should not call initPluginMetas and return true for correct id', async () => {
      const installed = await isPanelPluginInstalled('grafana-test-panel');

      expect(installed).toEqual(true);
      expect(initPluginMetasMock).not.toHaveBeenCalled();
    });

    it('isPanelPluginInstalled should not call initPluginMetas and return true for correct aliasIDs', async () => {
      const aliased = { ...panel, aliasIDs: ['some-alias'] };
      setPanelPluginMetas({ 'aliased-test-panel': aliased });

      const installed = await isPanelPluginInstalled('some-alias');

      expect(installed).toEqual(true);
      expect(initPluginMetasMock).not.toHaveBeenCalled();
    });

    it('isPanelPluginInstalled should return false if the pluginId is not found', async () => {
      const result = await isPanelPluginInstalled('otherorg-otherplugin-app');

      expect(result).toEqual(false);
    });

    it('getPanelPluginVersion should not call initPluginMetas and return correct result for correct id', async () => {
      const result = await getPanelPluginVersion('grafana-test-panel');

      expect(result).toEqual('1.0.0');
      expect(initPluginMetasMock).not.toHaveBeenCalled();
    });

    it('getPanelPluginVersion should not call initPluginMetas and return correct result for correct aliasIDs', async () => {
      const aliased = { ...panel, aliasIDs: ['some-alias'] };
      setPanelPluginMetas({ 'aliased-test-panel': aliased });

      const result = await getPanelPluginVersion('some-alias');

      expect(result).toEqual('1.0.0');
      expect(initPluginMetasMock).not.toHaveBeenCalled();
    });

    it('getPanelPluginVersion should return null if the pluginId is not found', async () => {
      const result = await getPanelPluginVersion('otherorg-otherplugin-app');

      expect(result).toEqual(null);
    });

    it('getListedPanelPluginIds should not call initPluginMetas and return correct pluginIds', async () => {
      const installed = await getListedPanelPluginIds();

      expect(installed).toEqual(['grafana-test-panel']);
      expect(initPluginMetasMock).not.toHaveBeenCalled();
    });
  });

  describe('and refetchPanelPluginMetas is called', () => {
    let backendSrv: BackendSrv;
    beforeEach(() => {
      setPanelPluginMetas({});
      jest.resetAllMocks();
      refetchPluginMetasMock.mockResolvedValue(v0alpha1Response);
      backendSrv = {
        chunked: jest.fn(),
        delete: jest.fn(),
        fetch: jest.fn(),
        patch: jest.fn(),
        post: jest.fn(),
        put: jest.fn(),
        get: jest.fn().mockResolvedValue({ panels: testPanels }),
        request: jest.fn(),
        datasourceRequest: jest.fn(),
      };
      setBackendSrv(backendSrv);
    });

    it('should call refetchPluginMetas', async () => {
      await refetchPanelPluginMetas();

      expect(refetchPluginMetasMock).toHaveBeenCalledTimes(1);
      expect(backendSrv.get).not.toHaveBeenCalled();
    });

    it('should set correct panels', async () => {
      await refetchPanelPluginMetas();

      const actual = await getPanelPluginMetas();

      const actualIds = actual.map((a) => a.id).sort();
      const expectedIds = Object.keys(testPanels).sort();

      expect(actual).toHaveLength(Object.keys(testPanels).length);
      expect(actualIds).toStrictEqual(expectedIds);
    });

    it('should return the last result for concurrent calls', async () => {
      refetchPluginMetasMock
        .mockResolvedValueOnce(v0alpha1Response)
        .mockResolvedValue({ items: [v0alpha1Response.items[0]] });

      const promise1 = refetchPanelPluginMetas();
      const promise2 = refetchPanelPluginMetas();

      await Promise.all([promise1, promise2]);

      const actual = await getPanelPluginMetas();

      const actualIds = actual.map((a) => a.id).sort();

      expect(actual).toHaveLength(1);
      expect(actualIds).toStrictEqual([v0alpha1Response.items[0].spec.pluginJson.id]);
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

  describe('and panels is not initialized', () => {
    beforeEach(() => {
      setPanelPluginMetas({});
      jest.resetAllMocks();
    });

    it('getPanelPluginMetas should not call initPluginMetas and return correct result', async () => {
      const panels = await getPanelPluginMetas();

      expect(panels).toEqual([]);
      expect(initPluginMetasMock).not.toHaveBeenCalled();
    });

    it('getListedPanelPluginMetas should not call initPluginMetas and return correct result', async () => {
      const panels = await getListedPanelPluginMetas();

      expect(panels).toEqual([]);
      expect(initPluginMetasMock).not.toHaveBeenCalled();
    });

    it('getPanelPluginMetasMap should not call initPluginMetas and return correct result', async () => {
      const panels = await getPanelPluginMetasMap();

      expect(panels).toEqual({});
      expect(initPluginMetasMock).not.toHaveBeenCalled();
    });

    it('getPanelPluginMeta should not call initPluginMetas and return correct result', async () => {
      const result = await getPanelPluginMeta('grafana-test-panel');

      expect(result).toEqual(null);
      expect(initPluginMetasMock).not.toHaveBeenCalled();
    });

    it('isPanelPluginInstalled should not call initPluginMetas and return false', async () => {
      const result = await isPanelPluginInstalled('grafana-test-panel');

      expect(result).toEqual(false);
      expect(initPluginMetasMock).not.toHaveBeenCalled();
    });

    it('getPanelPluginVersion should not call initPluginMetas and return correct result', async () => {
      const result = await getPanelPluginVersion('grafana-test-panel');

      expect(result).toEqual(null);
      expect(initPluginMetasMock).not.toHaveBeenCalled();
    });

    it('getListedPanelPluginIds should not call initPluginMetas and return an empty array', async () => {
      const result = await getListedPanelPluginIds();

      expect(result).toEqual([]);
      expect(initPluginMetasMock).not.toHaveBeenCalled();
    });
  });

  describe('and panels is initialized', () => {
    beforeEach(() => {
      setPanelPluginMetas({ 'grafana-test-panel': panel });
      jest.resetAllMocks();
    });

    it('getPanelPluginMetas should not call initPluginMetas and return correct result', async () => {
      const panels = await getPanelPluginMetas();

      expect(panels).toEqual([panel]);
      expect(initPluginMetasMock).not.toHaveBeenCalled();
    });

    it('getListedPanelPluginMetas should not call initPluginMetas and return correct result', async () => {
      setPanelPluginMetas({
        'grafana-test-panel': panel,
        'grafana-hidden-panel': { ...panel, id: 'grafana-hidden-panel', hideFromList: true },
        'grafana-sorted-first-panel': { ...panel, id: 'grafana-sorted-first-panel', sort: 10 },
      });
      const panels = await getListedPanelPluginMetas();

      expect(panels).toEqual([{ ...panel, id: 'grafana-sorted-first-panel', sort: 10 }, panel]);
      expect(initPluginMetasMock).not.toHaveBeenCalled();
    });

    it('getPanelPluginMetasMap should not call initPluginMetas and return correct result', async () => {
      const panels = await getPanelPluginMetasMap();

      expect(panels).toEqual({ 'grafana-test-panel': panel });
      expect(initPluginMetasMock).not.toHaveBeenCalled();
    });

    it('getPanelPluginMeta should not call initPluginMetas and return correct result', async () => {
      const result = await getPanelPluginMeta('grafana-test-panel');

      expect(result).toEqual(panel);
      expect(initPluginMetasMock).not.toHaveBeenCalled();
    });

    it('getPanelPluginMeta should return null if the pluginId is not found', async () => {
      const result = await getPanelPluginMeta('otherorg-otherplugin-panel');

      expect(result).toEqual(null);
    });

    it('isPanelPluginInstalled should not call initPluginMetas and return true', async () => {
      const result = await isPanelPluginInstalled('grafana-test-panel');

      expect(result).toEqual(true);
      expect(initPluginMetasMock).not.toHaveBeenCalled();
    });

    it('isPanelPluginInstalled should return false if the pluginId is not found', async () => {
      const result = await isPanelPluginInstalled('otherorg-otherplugin-app');

      expect(result).toEqual(false);
    });

    it('getPanelPluginVersion should not call initPluginMetas and return correct result', async () => {
      const result = await getPanelPluginVersion('grafana-test-panel');

      expect(result).toEqual('1.0.0');
      expect(initPluginMetasMock).not.toHaveBeenCalled();
    });

    it('getPanelPluginVersion should return null if the pluginId is not found', async () => {
      const result = await getPanelPluginVersion('otherorg-otherplugin-app');

      expect(result).toEqual(null);
    });

    it('getListedPanelPluginIds should not call initPluginMetas and return correct pluginIds', async () => {
      const result = await getListedPanelPluginIds();

      expect(result).toEqual(['grafana-test-panel']);
      expect(initPluginMetasMock).not.toHaveBeenCalled();
    });
  });

  describe('when useMTPlugins flag is disabled and refetchPanelPluginMetas is called', () => {
    let backendSrv: BackendSrv;
    beforeEach(() => {
      setPanelPluginMetas({});
      jest.resetAllMocks();
      refetchPluginMetasMock.mockResolvedValue({ items: [] });
      backendSrv = {
        chunked: jest.fn(),
        delete: jest.fn(),
        fetch: jest.fn(),
        patch: jest.fn(),
        post: jest.fn(),
        put: jest.fn(),
        get: jest.fn().mockResolvedValue({ panels: testPanels }),
        request: jest.fn(),
        datasourceRequest: jest.fn(),
      };
      setBackendSrv(backendSrv);
    });

    it('should call /api/frontend/settings', async () => {
      await refetchPanelPluginMetas();

      expect(backendSrv.get).toHaveBeenCalledTimes(1);
      expect(backendSrv.get).toHaveBeenCalledWith('/api/frontend/settings');
      expect(refetchPluginMetasMock).not.toHaveBeenCalled();
    });

    it('should set correct panels', async () => {
      await refetchPanelPluginMetas();

      const actual = await getPanelPluginMetas();

      const actualIds = actual.map((a) => a.id).sort();
      const expectedIds = Object.keys(testPanels).sort();

      expect(actual).toHaveLength(Object.keys(testPanels).length);
      expect(actualIds).toStrictEqual(expectedIds);
    });

    it('should return the last result for concurrent calls', async () => {
      backendSrv.get = jest
        .fn()
        .mockResolvedValueOnce({ panels: testPanels })
        .mockResolvedValue({ panels: { alertlist: testPanels.alertlist } });

      const promise1 = refetchPanelPluginMetas();
      const promise2 = refetchPanelPluginMetas();

      await Promise.all([promise1, promise2]);

      const actual = await getPanelPluginMetas();

      const actualIds = actual.map((a) => a.id).sort();

      expect(actual).toHaveLength(1);
      expect(actualIds).toStrictEqual(['alertlist']);
    });
  });
});

describe('immutability', () => {
  beforeEach(() => {
    setPanelPluginMetas({ 'grafana-test-panel': panel });
    jest.resetAllMocks();
  });

  it('getPanelPluginMetas should return a deep clone', async () => {
    const mutatedPanels = await getPanelPluginMetas();

    // assert we have correct props
    expect(mutatedPanels).toHaveLength(1);
    expect(mutatedPanels[0].info.author.name).toEqual('Grafana');
    expect(mutatedPanels[0].info.links).toHaveLength(0);

    // mutate deep props
    mutatedPanels[0].info.author.name = '';
    mutatedPanels[0].info.links.push({ name: '', url: '' });

    // assert we have mutated props
    expect(mutatedPanels[0].info.author.name).toEqual('');
    expect(mutatedPanels[0].info.links).toHaveLength(1);
    expect(mutatedPanels[0].info.links[0]).toEqual({ name: '', url: '' });

    const panels = await getPanelPluginMetas();

    // assert that we have not mutated the source
    expect(panels[0].info.author.name).toEqual('Grafana');
    expect(panels[0].info.links).toHaveLength(0);
  });

  it('getPanelPluginMetasMap should return a deep clone', async () => {
    const mutatedPanels = await getPanelPluginMetasMap();

    // assert we have correct props
    expect(mutatedPanels).toEqual({ 'grafana-test-panel': panel });
    expect(mutatedPanels['grafana-test-panel'].info.author.name).toEqual('Grafana');
    expect(mutatedPanels['grafana-test-panel'].info.links).toHaveLength(0);

    // mutate deep props
    mutatedPanels['grafana-test-panel'].info.author.name = '';
    mutatedPanels['grafana-test-panel'].info.links.push({ name: '', url: '' });

    // assert we have mutated props
    expect(mutatedPanels['grafana-test-panel'].info.author.name).toEqual('');
    expect(mutatedPanels['grafana-test-panel'].info.links).toHaveLength(1);
    expect(mutatedPanels['grafana-test-panel'].info.links[0]).toEqual({ name: '', url: '' });

    const panels = await getPanelPluginMetasMap();

    // assert that we have not mutated the source
    expect(panels).toEqual({ 'grafana-test-panel': panel });
    expect(panels['grafana-test-panel'].info.author.name).toEqual('Grafana');
    expect(panels['grafana-test-panel'].info.links).toHaveLength(0);
  });

  it('getPanelPluginMetasMapSync should return a deep clone', () => {
    const mutatedPanels = getPanelPluginMetasMapSync();

    // assert we have correct props
    expect(mutatedPanels).toEqual({ 'grafana-test-panel': panel });
    expect(mutatedPanels['grafana-test-panel'].info.author.name).toEqual('Grafana');
    expect(mutatedPanels['grafana-test-panel'].info.links).toHaveLength(0);

    // mutate deep props
    mutatedPanels['grafana-test-panel'].info.author.name = '';
    mutatedPanels['grafana-test-panel'].info.links.push({ name: '', url: '' });

    // assert we have mutated props
    expect(mutatedPanels['grafana-test-panel'].info.author.name).toEqual('');
    expect(mutatedPanels['grafana-test-panel'].info.links).toHaveLength(1);
    expect(mutatedPanels['grafana-test-panel'].info.links[0]).toEqual({ name: '', url: '' });

    const panels = getPanelPluginMetasMapSync();

    // assert that we have not mutated the source
    expect(panels).toEqual({ 'grafana-test-panel': panel });
    expect(panels['grafana-test-panel'].info.author.name).toEqual('Grafana');
    expect(panels['grafana-test-panel'].info.links).toHaveLength(0);
  });

  it('getPanelPluginMeta should return a deep clone', async () => {
    const mutatedApp = await getPanelPluginMeta('grafana-test-panel');

    // assert we have correct props
    expect(mutatedApp).toBeDefined();
    expect(mutatedApp!.info.author.name).toEqual('Grafana');
    expect(mutatedApp!.info.links).toHaveLength(0);

    // mutate deep props
    mutatedApp!.info.author.name = '';
    mutatedApp!.info.links.push({ name: '', url: '' });

    // assert we have mutated props
    expect(mutatedApp!.info.author.name).toEqual('');
    expect(mutatedApp!.info.links).toHaveLength(1);
    expect(mutatedApp!.info.links[0]).toEqual({ name: '', url: '' });

    const result = await getPanelPluginMeta('grafana-test-panel');

    // assert that we have not mutated the source
    expect(result).toBeDefined();
    expect(result!.info.author.name).toEqual('Grafana');
    expect(result!.info.links).toHaveLength(0);
  });
});
