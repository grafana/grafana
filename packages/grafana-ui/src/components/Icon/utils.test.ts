import { getIconSubDir } from './utils';

describe('Icon utils', () => {
  describe('getIconSubDir', () => {
    it.each`
      name          | type         | expected
      ${'gf-panel'} | ${undefined} | ${'custom'}
      ${'grafana'}  | ${undefined} | ${'mono'}
      ${'bookmark'} | ${'default'} | ${'unicons'}
      ${'bookmark'} | ${'solid'}   | ${'solid'}
      ${'bookmark'} | ${undefined} | ${'mono'}
      ${'folder'}   | ${'mono'}    | ${'mono'}
    `('it returns the correct iconSubDir for icon $name with type $type', ({ name, type, expected }) => {
      const iconSubDir = getIconSubDir(name, type);
      expect(iconSubDir).toEqual(expected);
    });
  });
});
