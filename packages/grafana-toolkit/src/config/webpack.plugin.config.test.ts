import { findModuleFiles } from './webpack.plugin.config';
const fs = require('fs');

jest.mock('fs');

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
      fs.statSync.mockReturnValue({
        isDirectory: () => false,
      });
    });

    it('finds module.ts and module.tsx files', () => {
      const moduleFiles = findModuleFiles('/', modulePathsMock);
      expect(moduleFiles.length).toBe(2);
      expect(moduleFiles).toEqual(['/some/path/module.ts', '/some/path/module.tsx']);
    });
  });
});
