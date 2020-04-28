// Use the real plugin_loader (stubbed by default)
jest.unmock('app/features/plugins/plugin_loader');

(global as any).ace = {
  define: jest.fn(),
};

jest.mock('app/core/core', () => {
  return {
    coreModule: {
      directive: jest.fn(),
    },
  };
});

import { SystemJS } from '@grafana/runtime';
import { AppPluginMeta, PluginMetaInfo, PluginType, AppPlugin } from '@grafana/data';

// Loaded after the `unmock` abve
import { importAppPlugin } from './plugin_loader';

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

  beforeAll(() => {
    SystemJS.set(modulePath, SystemJS.newModule({ plugin: app }));
  });

  afterAll(() => {
    SystemJS.delete(modulePath);
  });

  it('should call init and set meta', async () => {
    const meta: AppPluginMeta = {
      id: 'test-app',
      module: modulePath,
      baseUrl: 'xxx',
      info: {} as PluginMetaInfo,
      type: PluginType.app,
      name: 'test',
    };

    // Check that we mocked the import OK
    const m = await SystemJS.import(modulePath);
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
