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

// Need to import a path that has a real export
const modulePath = 'app/plugins/app/example-app/module';
jest.mock(modulePath, () => {
  return {
    plugin: app,
  };
});

describe('Load App', () => {
  it('should call init and set meta', async () => {
    const meta: AppPluginMeta = {
      id: 'test-app',
      module: modulePath,
      baseUrl: 'xxx',
      info: {} as PluginMetaInfo,
      type: PluginType.app,
      name: 'test',
    };

    // // Check that we mocked the import OK
    // const v = await System.import(modulePath);
    // expect(v.plugin).toBe(app);

    const loaded = await importAppPlugin(meta);
    expect(loaded.meta).toBe(meta);
    expect(app.initWasCalled).toBeTruthy();
  });
});
