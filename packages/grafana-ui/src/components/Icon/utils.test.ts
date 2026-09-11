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

  describe('getIconRoot', () => {
    beforeEach(() => {
      // will reset the iconRoot cached value
      jest.resetModules();
    });

    describe('when the build path is configured', () => {
      beforeAll(() => {
        //@ts-ignore
        window.__grafana_build_path__ = 'somepath/public/build/rspack/';
      });

      it('should return icon root based on __grafana_build_path__', () => {
        const { getIconRoot } = require('./utils');
        expect(getIconRoot()).toEqual('somepath/public/build/rspack/img/icons/');
      });
    });

    describe('when the build path is not configured', () => {
      beforeAll(() => {
        //@ts-ignore
        window.__grafana_build_path__ = undefined;
      });

      it('should return default icon root', () => {
        const { getIconRoot } = require('./utils');
        expect(getIconRoot()).toEqual('public/build/img/icons/');
      });
    });
  });
});
