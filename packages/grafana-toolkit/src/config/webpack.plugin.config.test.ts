import { findModuleFiles, loadWebpackConfig } from './webpack.plugin.config';
import fs from 'fs';
import * as webpackConfig from './webpack.plugin.config';

jest.mock('./webpack/loaders', () => ({
  getFileLoaders: () => [],
  getStylesheetEntries: () => [],
  getStyleLoaders: () => [],
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

    it('finds module.ts and module.tsx files', () => {
      const moduleFiles = findModuleFiles('/', modulePathsMock);
      expect(moduleFiles.length).toBe(2);
      expect(moduleFiles).toEqual(['/some/path/module.ts', '/some/path/module.tsx']);
    });
  });

  describe('loadWebpackConfig', () => {
    beforeAll(() => {
      jest.spyOn(webpackConfig, 'findModuleFiles').mockReturnValue([]);
    });

    afterAll(() => {
      jest.restoreAllMocks();
    });

    it('uses default config if no override exists', () => {
      const spy = jest.spyOn(process, 'cwd');
      spy.mockReturnValue(`${__dirname}/mocks/webpack/noOverride/`);
      loadWebpackConfig({});
    });

    it('calls customConfig if it exists', () => {
      const spy = jest.spyOn(process, 'cwd');
      spy.mockReturnValue(`${__dirname}/mocks/webpack/overrides/`);
      const config = loadWebpackConfig({});
      expect(config.name).toBe('customConfig');
    });

    it('throws an error if module does not export function', () => {
      const spy = jest.spyOn(process, 'cwd');
      spy.mockReturnValue(`${__dirname}/mocks/webpack/unsupportedOverride/`);
      expect(() => loadWebpackConfig({})).toThrowError();
    });
  });
});
