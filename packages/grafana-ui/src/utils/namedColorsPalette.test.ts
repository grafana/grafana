import {
  getColorName,
  getColorDefinition,
  getColorByName,
  getColorFromHexRgbOrName,
  getColorDefinitionByName,
} from './namedColorsPalette';
import { GrafanaTheme } from '../types/index';

describe('colors', () => {
  const SemiDarkBlue = getColorDefinitionByName('semi-dark-blue');

  describe('getColorDefinition', () => {
    it('returns undefined for unknown hex', () => {
      expect(getColorDefinition('#ff0000', GrafanaTheme.Light)).toBeUndefined();
      expect(getColorDefinition('#ff0000', GrafanaTheme.Dark)).toBeUndefined();
    });

    it('returns definition for known hex', () => {
      expect(getColorDefinition(SemiDarkBlue.variants.light, GrafanaTheme.Light)).toEqual(SemiDarkBlue);
      expect(getColorDefinition(SemiDarkBlue.variants.dark, GrafanaTheme.Dark)).toEqual(SemiDarkBlue);
    });
  });

  describe('getColorName', () => {
    it('returns undefined for unknown hex', () => {
      expect(getColorName('#ff0000')).toBeUndefined();
    });

    it('returns name for known hex', () => {
      expect(getColorName(SemiDarkBlue.variants.light, GrafanaTheme.Light)).toEqual(SemiDarkBlue.name);
      expect(getColorName(SemiDarkBlue.variants.dark, GrafanaTheme.Dark)).toEqual(SemiDarkBlue.name);
    });
  });

  describe('getColorByName', () => {
    it('returns undefined for unknown color', () => {
      expect(getColorByName('aruba-sunshine')).toBeUndefined();
    });

    it('returns color definiton for known color', () => {
      expect(getColorByName(SemiDarkBlue.name)).toBe(SemiDarkBlue);
    });
  });

  describe('getColorFromHexRgbOrName', () => {
    it('returns undefined for unknown color', () => {
      expect(() => getColorFromHexRgbOrName('aruba-sunshine')).toThrow();
    });

    it('returns dark hex variant for known color if theme not specified', () => {
      expect(getColorFromHexRgbOrName(SemiDarkBlue.name)).toBe(SemiDarkBlue.variants.dark);
    });

    it("returns correct variant's hex for known color if theme specified", () => {
      expect(getColorFromHexRgbOrName(SemiDarkBlue.name, GrafanaTheme.Light)).toBe(SemiDarkBlue.variants.light);
    });

    it('returns color if specified as hex or rgb/a', () => {
      expect(getColorFromHexRgbOrName('ff0000')).toBe('ff0000');
      expect(getColorFromHexRgbOrName('#ff0000')).toBe('#ff0000');
      expect(getColorFromHexRgbOrName('rgb(0,0,0)')).toBe('rgb(0,0,0)');
      expect(getColorFromHexRgbOrName('rgba(0,0,0,1)')).toBe('rgba(0,0,0,1)');
    });
  });
});
