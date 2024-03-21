import { type GetPluginExtensions } from './getPluginExtensions';
import { setPluginExtensionsHook, usePluginExtensions } from './usePluginExtensions';

describe('Plugin Extensions / usePluginExtensions', () => {
  afterEach(() => {
    process.env.NODE_ENV = 'test';
  });

  test('should always return the same extension-hook function that was previously set', () => {
    const hook: GetPluginExtensions = jest.fn().mockReturnValue({ extensions: [] });

    setPluginExtensionsHook(hook);
    usePluginExtensions({ extensionPointId: 'panel-menu' });

    expect(hook).toHaveBeenCalledTimes(1);
    expect(hook).toHaveBeenCalledWith({ extensionPointId: 'panel-menu' });
  });

  test('should throw an error when trying to redefine the app-wide extension-hook function', () => {
    // By default, NODE_ENV is set to 'test' in jest.config.js, which allows to override the registry in tests.
    process.env.NODE_ENV = 'production';

    const hook: GetPluginExtensions = () => ({ extensions: [] });

    expect(() => {
      setPluginExtensionsHook(hook);
      setPluginExtensionsHook(hook);
    }).toThrowError();
  });

  test('should throw an error when trying to access the extension-hook function before it was set', () => {
    // "Unsetting" the registry
    // @ts-ignore
    setPluginExtensionsHook(undefined);

    expect(() => {
      usePluginExtensions({ extensionPointId: 'panel-menu' });
    }).toThrowError();
  });
});
