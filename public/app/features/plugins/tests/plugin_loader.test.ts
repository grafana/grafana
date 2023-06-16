// Use the real plugin_loader (stubbed by default)
jest.unmock('app/features/plugins/plugin_loader');

jest.mock('app/core/core', () => {
  return {
    coreModule: {
      directive: jest.fn(),
    },
  };
});

import { AppPluginMeta, PluginMetaInfo, PluginType, AppPlugin } from '@grafana/data';
import { SystemJS } from '@grafana/runtime';

// Loaded after the `unmock` above
import { importAppPlugin } from '../plugin_loader';

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
  const modulePath = 'http://localhost:300/public/plugins/my-app-plugin/module.js';
  // Hook resolver for tests
  const originalResolve = SystemJS.constructor.prototype.resolve;
  SystemJS.constructor.prototype.resolve = (x: unknown) => x;

  beforeAll(() => {
    SystemJS.set(modulePath, { plugin: app });
  });

  afterAll(() => {
    SystemJS.delete(modulePath);
    SystemJS.constructor.prototype.resolve = originalResolve;
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
