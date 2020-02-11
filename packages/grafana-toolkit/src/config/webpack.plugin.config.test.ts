import { findModuleFiles, loadWebpackConfig } from './webpack.plugin.config';
import fs from 'fs';
import * as webpackConfig from './webpack.plugin.config';

jest.mock('./webpack/loaders', () => ({
  getFileLoaders: (): Array<{}> => [],
  getStylesheetEntries: () => ({}),
  getStyleLoaders: (): Array<{}> => [],
}));

const modulePathsMock = [
  'some/path/module.ts',
  'some/path/module.ts.whatever',
  'some/path/module.tsx',
  'some/path/module.tsx.whatever',
  'some/path/anotherFile.ts',
  'some/path/anotherFile.tsx',
];

describe('Plugin webpack config', () => {
  describe('findModuleTs', () => {
    beforeAll(() => {
      jest.spyOn(fs, 'statSync').mockReturnValue({
        isDirectory: () => false,
      } as any);
    });

    afterAll(() => {
      jest.restoreAllMocks();
    });

    it('finds module.ts and module.tsx files', async () => {
      const moduleFiles = await findModuleFiles('/', modulePathsMock);
      expect(moduleFiles.length).toBe(2);
      // normalize windows path - \\ -> /
      expect(moduleFiles.map(p => p.replace(/\\/g, '/'))).toEqual(['/some/path/module.ts', '/some/path/module.tsx']);
    });
  });

  describe('loadWebpackConfig', () => {
    beforeAll(() => {
      jest.spyOn(webpackConfig, 'findModuleFiles').mockReturnValue(new Promise((res, _) => res([])));
    });

    afterAll(() => {
      jest.restoreAllMocks();
    });

    it('uses default config if no override exists', async () => {
      const spy = jest.spyOn(process, 'cwd');
      spy.mockReturnValue(`${__dirname}/mocks/webpack/noOverride/`);
      await loadWebpackConfig({});
    });

    it('calls customConfig if it exists', async () => {
      const spy = jest.spyOn(process, 'cwd');
      spy.mockReturnValue(`${__dirname}/mocks/webpack/overrides/`);
      const config = await loadWebpackConfig({});
      expect(config.name).toBe('customConfig');
    });

    it('loads export named getWebpackConfiguration', async () => {
      const spy = jest.spyOn(process, 'cwd');
      spy.mockReturnValue(`${__dirname}/mocks/webpack/overridesNamedExport/`);
      const config = await loadWebpackConfig({});
      expect(config.name).toBe('customConfig');
    });

    it('throws an error if module does not export function', async () => {
      const spy = jest.spyOn(process, 'cwd');
      spy.mockReturnValue(`${__dirname}/mocks/webpack/unsupportedOverride/`);
      await expect(loadWebpackConfig({})).rejects.toThrowError();
    });
  });
});
