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
import { AppPluginMeta, PluginMetaInfo, PluginType, PluginIncludeType, AppPlugin } from '@grafana/data';
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

import { ExampleConfigCtrl as ConfigCtrl } from 'app/plugins/app/example-app/legacy/config';
import { AngularExamplePageCtrl } from 'app/plugins/app/example-app/legacy/angular_example_page';

describe('Load Legacy App', () => {
  const app = {
    ConfigCtrl,
    AngularExamplePageCtrl, // Must match `pages.component` in plugin.json
  };

  const modulePath = 'my/custom/legacy/plugin/module';

  beforeAll(() => {
    SystemJS.set(modulePath, SystemJS.newModule(app));
  });

  afterAll(() => {
    SystemJS.delete(modulePath);
  });

  it('should call init and set meta for legacy app', async () => {
    const meta: AppPluginMeta = {
      id: 'test-app',
      module: modulePath,
      baseUrl: 'xxx',
      info: {} as PluginMetaInfo,
      type: PluginType.app,
      name: 'test',
      includes: [
        {
          type: PluginIncludeType.page,
          name: 'Example Page',
          component: 'AngularExamplePageCtrl',
          role: 'Viewer',
          addToNav: false,
        },
      ],
    };

    const loaded = await importAppPlugin(meta);
    expect(loaded).toHaveProperty('angularPages');
    expect(loaded.angularPages).toHaveProperty('AngularExamplePageCtrl', AngularExamplePageCtrl);
  });
});
