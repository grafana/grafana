import { AppPluginMeta, PluginMetaInfo, PluginType, AppPlugin } from '@grafana/ui';
import { importAppPlugin } from './plugin_loader';

class MyCustomApp extends AppPlugin {
  initWasCalled = false;
  calledTwice = false;

  init(meta: AppPluginMeta) {
    this.initWasCalled = true;
    this.calledTwice = this.meta === meta;
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
    expect(loaded).toBe(app);
    expect(app.meta).toBe(meta);
    expect(app.initWasCalled).toBeTruthy();
    expect(app.calledTwice).toBeFalsy();

    const again = await importAppPlugin(meta);
    expect(again).toBe(app);
    expect(app.calledTwice).toBeTruthy();
  });
});
