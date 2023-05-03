import { setPluginExtensionGetter, type GetPluginExtensions, getPluginExtensions } from './getPluginExtensions';

describe('Plugin Extensions / Get Plugin Extensions', () => {
  afterEach(() => {
    process.env.NODE_ENV = 'test';
  });

  test('should always return the same extension-getter function that was previously set', () => {
    const getter: GetPluginExtensions = jest.fn().mockReturnValue({ extensions: [] });

    setPluginExtensionGetter(getter);
    getPluginExtensions({ extensionPointId: 'panel-menu' });

    expect(getter).toHaveBeenCalledTimes(1);
    expect(getter).toHaveBeenCalledWith({ extensionPointId: 'panel-menu' });
  });

  test('should throw an error when trying to redefine the app-wide extension-getter function', () => {
    // By default, NODE_ENV is set to 'test' in jest.config.js, which allows to override the registry in tests.
    process.env.NODE_ENV = 'production';

    const getter: GetPluginExtensions = () => ({ extensions: [] });

    expect(() => {
      setPluginExtensionGetter(getter);
      setPluginExtensionGetter(getter);
    }).toThrowError();
  });

  test('should throw an error when trying to access the extension-getter function before it was set', () => {
    // "Unsetting" the registry
    // @ts-ignore
    setPluginExtensionGetter(undefined);

    expect(() => {
      getPluginExtensions({ extensionPointId: 'panel-menu' });
    }).toThrowError();
  });
});
