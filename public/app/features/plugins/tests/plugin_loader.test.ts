jest.mock('app/core/core', () => {
  return {
    coreModule: {
      directive: jest.fn(),
    },
  };
});

import { AppPluginMeta, PluginMetaInfo, PluginType, AppPlugin } from '@grafana/data';

// Loaded after the `unmock` above
import { addedComponentsRegistry, addedLinksRegistry, exposedComponentsRegistry } from '../extensions/registry/setup';
import { SystemJS } from '../loader/systemjs';
import { importAppPlugin } from '../plugin_loader';

jest.mock('../extensions/registry/setup');

describe('Load App', () => {
  const app = new AppPlugin();
  const modulePath = 'http://localhost:3000/public/plugins/my-app-plugin/module.js';
  // Hook resolver for tests
  const originalResolve = SystemJS.constructor.prototype.resolve;
  SystemJS.constructor.prototype.resolve = (x: unknown) => x;

  beforeAll(() => {
    app.init = jest.fn();
    addedComponentsRegistry.register = jest.fn();
    addedLinksRegistry.register = jest.fn();
    exposedComponentsRegistry.register = jest.fn();

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

    // Importing the app should initialise the meta
    const importedApp = await importAppPlugin(meta);
    expect(importedApp).toBe(app);
    expect(app.meta).toBe(meta);

    // Importing the same app again doesn't initialise it twice
    const importedAppAgain = await importAppPlugin(meta);
    expect(importedAppAgain).toBe(app);
    expect(app.init).toHaveBeenCalledTimes(1);
    expect(addedComponentsRegistry.register).toHaveBeenCalledTimes(1);
    expect(addedLinksRegistry.register).toHaveBeenCalledTimes(1);
    expect(exposedComponentsRegistry.register).toHaveBeenCalledTimes(1);
  });
});
