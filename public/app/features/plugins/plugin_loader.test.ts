// Use the real plugin_loader (stubbed by default)
jest.unmock('app/features/plugins/plugin_loader');

(global as any).ace = {
  define: jest.fn(),
};

jest.mock('app/core/core', () => ({
  coreModule: {
    directive: jest.fn(),
  },
}));

import { SystemJS } from '@grafana/runtime';
import { AppPluginMeta, PluginMetaInfo, PluginType, AppPlugin } from '@grafana/data';

// Loaded after the `unmock` above
import { exposeAsyncModules, ExposedModulesConfig, importAppPlugin } from './plugin_loader';

class MyCustomApp extends AppPlugin {
  initWasCalled = false;
  calledTwice = false;

  init(meta: AppPluginMeta) {
    this.initWasCalled = true;
    this.calledTwice = this.meta === meta;
  }
}

describe('Load App', () => {
  const app = new MyCustomApp();
  const modulePath = 'my/custom/plugin/module';
  let exposedModulesConfig: ExposedModulesConfig | undefined;

  beforeAll(async () => {
    exposedModulesConfig = await exposeAsyncModules(
      [
        {
          isPluginModule: true,
          key: modulePath,
          value: { plugin: app },
        },
      ],
      true
    );
  });

  afterAll(() => {
    exposedModulesConfig?.modules.forEach(({ url }) => SystemJS.delete(url));
    exposedModulesConfig?.importMap.remove();
    return SystemJS.prepareImport(true); // reprocess all
  });

  it('calls init and sets meta', async () => {
    const meta: AppPluginMeta = {
      id: 'test-app',
      module: modulePath,
      baseUrl: 'xxx',
      info: {} as PluginMetaInfo,
      type: PluginType.app,
      name: 'test',
    };

    // Check that we mocked the import OK
    const resolvedModulePath = exposedModulesConfig?.modules.filter(({ key }) => key === modulePath)[0].url;
    const m = await SystemJS.import(resolvedModulePath);
    expect(m.plugin).toBe(app);

    const loaded = await importAppPlugin(meta);
    expect(loaded).toBe(app);
    expect(app.meta).toBe(meta);
    expect(app.initWasCalled).toBeTruthy();
    expect(app.calledTwice).toBeFalsy();

    const again = await importAppPlugin(meta);
    expect(again).toBe(app);
    expect(app.calledTwice).toBeTruthy();
  });
});
