import { setTestFlags } from '@grafana/test-utils/unstable';

import { getLogger, setLogger } from '../logging/registry';

import {
  getAppPluginMeta,
  getAppPluginMetas,
  getAppPluginVersion,
  isAppPluginInstalled,
  setAppPluginMetas,
} from './apps';
import { initPluginMetas } from './plugins';
import { app, apps as testApps } from './test-fixtures/config.apps';
import { v0alpha1Response } from './test-fixtures/v0alpha1Response';

jest.mock('./plugins', () => ({ ...jest.requireActual('./plugins'), initPluginMetas: jest.fn() }));

const initPluginMetasMock = jest.mocked(initPluginMetas);
const getGrafanaExploretracesApp = () =>
  structuredClone(v0alpha1Response.items.find((a) => a.spec.pluginJson.id === 'grafana-exploretraces-app'));

describe('when useMTPlugins flag is enabled', () => {
  beforeAll(() => {
    setTestFlags({ useMTPlugins: true });
  });

  afterAll(() => {
    setTestFlags({});
  });

  describe('and apps is not initialized', () => {
    beforeEach(() => {
      setAppPluginMetas({});
      jest.resetAllMocks();
      initPluginMetasMock.mockResolvedValue({ items: [getGrafanaExploretracesApp()!] });
    });

    it('getAppPluginMetas should call initPluginMetas and return correct result', async () => {
      const apps = await getAppPluginMetas();

      expect(apps).toMatchObject([testApps['grafana-exploretraces-app']]);
      expect(initPluginMetasMock).toHaveBeenCalledTimes(1);
    });

    it('getAppPluginMeta should call initPluginMetas and return app if app exists', async () => {
      const result = await getAppPluginMeta('grafana-exploretraces-app');

      expect(result).toMatchObject(testApps['grafana-exploretraces-app']);
      expect(initPluginMetasMock).toHaveBeenCalledTimes(1);
    });

    it('getAppPluginMeta should call initPluginMetas and return null if app does not exist', async () => {
      const result = await getAppPluginMeta('myorg-someplugin-app');

      expect(result).toEqual(null);
      expect(initPluginMetasMock).toHaveBeenCalledTimes(1);
    });

    it('isAppPluginInstalled should call initPluginMetas and return true if app exists', async () => {
      const installed = await isAppPluginInstalled('grafana-exploretraces-app');

      expect(installed).toEqual(true);
      expect(initPluginMetasMock).toHaveBeenCalledTimes(1);
    });

    it('isAppPluginInstalled should call initPluginMetas and return false if app does not exist', async () => {
      const installed = await isAppPluginInstalled('myorg-someplugin-app');

      expect(installed).toEqual(false);
      expect(initPluginMetasMock).toHaveBeenCalledTimes(1);
    });

    it('getAppPluginVersion should call initPluginMetas and return null if app exists', async () => {
      const result = await getAppPluginVersion('grafana-exploretraces-app');

      expect(result).toEqual('1.2.2');
      expect(initPluginMetasMock).toHaveBeenCalledTimes(1);
    });

    it('getAppPluginVersion should call initPluginMetas and return null if app does not exist', async () => {
      const result = await getAppPluginVersion('myorg-someplugin-app');

      expect(result).toEqual(null);
      expect(initPluginMetasMock).toHaveBeenCalledTimes(1);
    });

    describe('and initPluginMetas returns an empty result', () => {
      beforeEach(() => {
        jest.resetAllMocks();
        initPluginMetasMock.mockResolvedValue({ items: [] });
        // can't use mockLogger here because that would cause a circular dependency between @grafana/runtime and @grafana/test-utils
        setLogger('grafana/runtime.plugins.meta', {
          logDebug: jest.fn(),
          logError: jest.fn(),
          logInfo: jest.fn(),
          logMeasurement: jest.fn(),
          logWarning: jest.fn(),
        });
      });

      it.each([{ func: getAppPluginMetas }])(
        `when func:$func is called then a warning should be logged`,
        async ({ func }) => {
          await func();

          expect(getLogger('grafana/runtime.plugins.meta').logWarning).toHaveBeenCalledTimes(1);
          expect(getLogger('grafana/runtime.plugins.meta').logWarning).toHaveBeenCalledWith(
            'PluginMeta: plugin meta yielded an empty result so Grafana is falling back to bootdata',
            { type: 'app' }
          );
        }
      );

      it.each([{ func: getAppPluginMeta }, { func: isAppPluginInstalled }, { func: getAppPluginVersion }])(
        `when func:$func is called then a warning should be logged`,
        async ({ func }) => {
          await func('');

          expect(getLogger('grafana/runtime.plugins.meta').logWarning).toHaveBeenCalledTimes(1);
          expect(getLogger('grafana/runtime.plugins.meta').logWarning).toHaveBeenCalledWith(
            'PluginMeta: plugin meta yielded an empty result so Grafana is falling back to bootdata',
            { type: 'app' }
          );
        }
      );
    });
  });

  describe('and apps is initialized', () => {
    beforeEach(() => {
      setAppPluginMetas({ 'myorg-someplugin-app': app });
      jest.resetAllMocks();
    });

    it('getAppPluginMetas should not call initPluginMetas and return correct result', async () => {
      const apps = await getAppPluginMetas();

      expect(apps).toEqual([app]);
      expect(initPluginMetasMock).not.toHaveBeenCalled();
    });

    it('getAppPluginMeta should not call initPluginMetas and return correct result', async () => {
      const result = await getAppPluginMeta('myorg-someplugin-app');

      expect(result).toEqual(app);
      expect(initPluginMetasMock).not.toHaveBeenCalled();
    });

    it('getAppPluginMeta should return null if the pluginId is not found', async () => {
      const result = await getAppPluginMeta('otherorg-otherplugin-app');

      expect(result).toEqual(null);
    });

    it('isAppPluginInstalled should not call initPluginMetas and return true', async () => {
      const installed = await isAppPluginInstalled('myorg-someplugin-app');

      expect(installed).toEqual(true);
      expect(initPluginMetasMock).not.toHaveBeenCalled();
    });

    it('isAppPluginInstalled should return false if the pluginId is not found', async () => {
      const result = await isAppPluginInstalled('otherorg-otherplugin-app');

      expect(result).toEqual(false);
    });

    it('getAppPluginVersion should not call initPluginMetas and return correct result', async () => {
      const result = await getAppPluginVersion('myorg-someplugin-app');

      expect(result).toEqual('1.0.0');
      expect(initPluginMetasMock).not.toHaveBeenCalled();
    });

    it('getAppPluginVersion should return null if the pluginId is not found', async () => {
      const result = await getAppPluginVersion('otherorg-otherplugin-app');

      expect(result).toEqual(null);
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

  describe('and apps is not initialized', () => {
    beforeEach(() => {
      setAppPluginMetas({});
      jest.resetAllMocks();
    });

    it('getAppPluginMetas should not call initPluginMetas and return correct result', async () => {
      const apps = await getAppPluginMetas();

      expect(apps).toEqual([]);
      expect(initPluginMetasMock).not.toHaveBeenCalled();
    });

    it('getAppPluginMeta should not call initPluginMetas and return correct result', async () => {
      const result = await getAppPluginMeta('myorg-someplugin-app');

      expect(result).toEqual(null);
      expect(initPluginMetasMock).not.toHaveBeenCalled();
    });

    it('isAppPluginInstalled should not call initPluginMetas and return false', async () => {
      const result = await isAppPluginInstalled('myorg-someplugin-app');

      expect(result).toEqual(false);
      expect(initPluginMetasMock).not.toHaveBeenCalled();
    });

    it('getAppPluginVersion should not call initPluginMetas and return correct result', async () => {
      const result = await getAppPluginVersion('myorg-someplugin-app');

      expect(result).toEqual(null);
      expect(initPluginMetasMock).not.toHaveBeenCalled();
    });
  });

  describe('and apps is initialized', () => {
    beforeEach(() => {
      setAppPluginMetas({ 'myorg-someplugin-app': app });
      jest.resetAllMocks();
    });

    it('getAppPluginMetas should not call initPluginMetas and return correct result', async () => {
      const apps = await getAppPluginMetas();

      expect(apps).toEqual([app]);
      expect(initPluginMetasMock).not.toHaveBeenCalled();
    });

    it('getAppPluginMeta should not call initPluginMetas and return correct result', async () => {
      const result = await getAppPluginMeta('myorg-someplugin-app');

      expect(result).toEqual(app);
      expect(initPluginMetasMock).not.toHaveBeenCalled();
    });

    it('getAppPluginMeta should return null if the pluginId is not found', async () => {
      const result = await getAppPluginMeta('otherorg-otherplugin-app');

      expect(result).toEqual(null);
    });

    it('isAppPluginInstalled should not call initPluginMetas and return true', async () => {
      const result = await isAppPluginInstalled('myorg-someplugin-app');

      expect(result).toEqual(true);
      expect(initPluginMetasMock).not.toHaveBeenCalled();
    });

    it('isAppPluginInstalled should return false if the pluginId is not found', async () => {
      const result = await isAppPluginInstalled('otherorg-otherplugin-app');

      expect(result).toEqual(false);
    });

    it('getAppPluginVersion should not call initPluginMetas and return correct result', async () => {
      const result = await getAppPluginVersion('myorg-someplugin-app');

      expect(result).toEqual('1.0.0');
      expect(initPluginMetasMock).not.toHaveBeenCalled();
    });

    it('getAppPluginVersion should return null if the pluginId is not found', async () => {
      const result = await getAppPluginVersion('otherorg-otherplugin-app');

      expect(result).toEqual(null);
    });
  });
});

describe('immutability', () => {
  beforeEach(() => {
    setAppPluginMetas({ 'myorg-someplugin-app': app });
    jest.resetAllMocks();
  });

  it('getAppPluginMetas should return a deep clone', async () => {
    const mutatedApps = await getAppPluginMetas();

    // assert we have correct props
    expect(mutatedApps).toHaveLength(1);
    expect(mutatedApps[0].dependencies.grafanaDependency).toEqual('>=10.4.0');
    expect(mutatedApps[0].extensions.addedLinks).toHaveLength(0);

    // mutate deep props
    mutatedApps[0].dependencies.grafanaDependency = '';
    mutatedApps[0].extensions.addedLinks.push({
      targets: [],
      title: '',
      description: '',
    });

    // assert we have mutated props
    expect(mutatedApps[0].dependencies.grafanaDependency).toEqual('');
    expect(mutatedApps[0].extensions.addedLinks).toHaveLength(1);
    expect(mutatedApps[0].extensions.addedLinks[0]).toEqual({ targets: [], title: '', description: '' });

    const apps = await getAppPluginMetas();

    // assert that we have not mutated the source
    expect(apps[0].dependencies.grafanaDependency).toEqual('>=10.4.0');
    expect(apps[0].extensions.addedLinks).toHaveLength(0);
  });

  it('getAppPluginMeta should return a deep clone', async () => {
    const mutatedApp = await getAppPluginMeta('myorg-someplugin-app');

    // assert we have correct props
    expect(mutatedApp).toBeDefined();
    expect(mutatedApp!.dependencies.grafanaDependency).toEqual('>=10.4.0');
    expect(mutatedApp!.extensions.addedLinks).toHaveLength(0);

    // mutate deep props
    mutatedApp!.dependencies.grafanaDependency = '';
    mutatedApp!.extensions.addedLinks.push({ targets: [], title: '', description: '' });

    // assert we have mutated props
    expect(mutatedApp!.dependencies.grafanaDependency).toEqual('');
    expect(mutatedApp!.extensions.addedLinks).toHaveLength(1);
    expect(mutatedApp!.extensions.addedLinks[0]).toEqual({ targets: [], title: '', description: '' });

    const result = await getAppPluginMeta('myorg-someplugin-app');

    // assert that we have not mutated the source
    expect(result).toBeDefined();
    expect(result!.dependencies.grafanaDependency).toEqual('>=10.4.0');
    expect(result!.extensions.addedLinks).toHaveLength(0);
  });
});
