import { setTestFlags } from '@grafana/test-utils/unstable';

import {
  getAppPluginMeta,
  getAppPluginMetas,
  getAppPluginVersion,
  isAppPluginInstalled,
  setAppPluginMetas,
} from './apps';
import { initPluginMetas } from './plugins';
import { app } from './test-fixtures/config.apps';

jest.mock('./plugins', () => ({ ...jest.requireActual('./plugins'), initPluginMetas: jest.fn() }));

const initPluginMetasMock = jest.mocked(initPluginMetas);

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
      initPluginMetasMock.mockResolvedValue({ items: [] });
    });

    it('getAppPluginMetas should call initPluginMetas and return correct result', async () => {
      const apps = await getAppPluginMetas();

      expect(apps).toEqual([]);
      expect(initPluginMetasMock).toHaveBeenCalledTimes(1);
    });

    it('getAppPluginMeta should call initPluginMetas and return correct result', async () => {
      const result = await getAppPluginMeta('myorg-someplugin-app');

      expect(result).toEqual(null);
      expect(initPluginMetasMock).toHaveBeenCalledTimes(1);
    });

    it('isAppPluginInstalled should call initPluginMetas and return false', async () => {
      const installed = await isAppPluginInstalled('myorg-someplugin-app');

      expect(installed).toEqual(false);
      expect(initPluginMetasMock).toHaveBeenCalledTimes(1);
    });

    it('getAppPluginVersion should call initPluginMetas and return null', async () => {
      const result = await getAppPluginVersion('myorg-someplugin-app');

      expect(result).toEqual(null);
      expect(initPluginMetasMock).toHaveBeenCalledTimes(1);
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

describe('when useMTPlugins flag is enabled', () => {
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
