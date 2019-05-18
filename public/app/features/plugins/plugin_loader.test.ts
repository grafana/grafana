import { AppPluginMeta, PluginMetaInfo, PluginType, AppPlugin } from '@grafana/ui';
import { importAppPlugin } from './plugin_loader';

class MyCustomApp extends AppPlugin {
  initWasCalled = false;

  init() {
    this.initWasCalled = true;
    return this;
  }
}
const app = new MyCustomApp();

jest.mock('plugins/my/app', () => ({
  module: () => {
    return app;
  },
}));

describe('Load App', () => {
  it('should call init and set meta', async () => {
    const meta: AppPluginMeta = {
      id: 'test-app',
      module: 'plugins/my/app',
      baseUrl: 'xxx',
      info: {} as PluginMetaInfo,
      type: PluginType.app,
      name: 'test',
    };

    const loaded = await importAppPlugin(meta);
    expect(loaded.meta).toBe(meta);
    expect(app.initWasCalled).toBeTruthy();
  });
});
