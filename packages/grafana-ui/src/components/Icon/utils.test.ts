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

    describe('when public path is configured', () => {
      beforeAll(() => {
        //@ts-ignore
        window.__grafana_public_path__ = 'somepath/public/';
      });

      it('should return icon root based on __grafana_public_path__', () => {
        const { getIconRoot } = require('./utils');
        expect(getIconRoot()).toEqual('somepath/public/build/img/icons/');
      });
    });

    describe('when public path is not configured', () => {
      beforeAll(() => {
        //@ts-ignore
        window.__grafana_public_path__ = undefined;
      });

      it('should return default icon root', () => {
        const { getIconRoot } = require('./utils');
        expect(getIconRoot()).toEqual('public/build/img/icons/');
      });
    });
  });
});
