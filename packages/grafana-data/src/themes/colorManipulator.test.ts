import {
  recomposeColor,
  hexToRgb,
  rgbToHex,
  hslToRgb,
  darken,
  decomposeColor,
  emphasize,
  alpha,
  getContrastRatio,
  getLuminance,
  lighten,
  asRgbString,
  onBackground,
} from './colorManipulator';

describe('utils/colorManipulator', () => {
  const origError = console.error;
  const consoleErrorMock = jest.fn();
  afterEach(() => (console.error = origError));
  beforeEach(() => (console.error = consoleErrorMock));

  describe('recomposeColor', () => {
    it('converts a decomposed rgb color object to a string` ', () => {
      expect(
        recomposeColor({
          type: 'rgb',
          values: [255, 255, 255],
        })
      ).toEqual('rgb(255, 255, 255)');
    });

    it('converts a decomposed rgba color object to a string` ', () => {
      expect(
        recomposeColor({
          type: 'rgba',
          values: [255, 255, 255, 0.5],
        })
      ).toEqual('rgba(255, 255, 255, 0.5)');
    });

    it('converts a decomposed CSS4 color object to a string` ', () => {
      expect(
        recomposeColor({
          type: 'color',
          colorSpace: 'display-p3',
          values: [0.5, 0.3, 0.2],
        })
      ).toEqual('color(display-p3 0.5 0.3 0.2)');
    });

    it('converts a decomposed hsl color object to a string` ', () => {
      expect(
        recomposeColor({
          type: 'hsl',
          values: [100, 50, 25],
        })
      ).toEqual('hsl(100, 50%, 25%)');
    });

    it('converts a decomposed hsla color object to a string` ', () => {
      expect(
        recomposeColor({
          type: 'hsla',
          values: [100, 50, 25, 0.5],
        })
      ).toEqual('hsla(100, 50%, 25%, 0.5)');
    });
  });

  describe('hexToRgb', () => {
    it('converts a short hex color to an rgb color` ', () => {
      expect(hexToRgb('#9f3')).toEqual('rgb(153, 255, 51)');
    });

    it('converts a long hex color to an rgb color` ', () => {
      expect(hexToRgb('#a94fd3')).toEqual('rgb(169, 79, 211)');
    });

    it('converts a long alpha hex color to an argb color` ', () => {
      expect(hexToRgb('#111111f8')).toEqual('rgba(17, 17, 17, 0.973)');
    });
  });

  describe('rgbToHex', () => {
    it('converts an rgb color to a hex color` ', () => {
      expect(rgbToHex('rgb(169, 79, 211)')).toEqual('#a94fd3');
    });

    it('idempotent', () => {
      expect(rgbToHex('#A94FD3')).toEqual('#A94FD3');
    });
  });

  describe('hslToRgb', () => {
    it('converts an hsl color to an rgb color` ', () => {
      expect(hslToRgb('hsl(281, 60%, 57%)')).toEqual('rgb(169, 80, 211)');
    });

    it('converts an hsla color to an rgba color` ', () => {
      expect(hslToRgb('hsla(281, 60%, 57%, 0.5)')).toEqual('rgba(169, 80, 211, 0.5)');
    });

    it('allow to convert values only', () => {
      expect(hslToRgb(decomposeColor('hsl(281, 60%, 57%)'))).toEqual('rgb(169, 80, 211)');
    });
  });

  describe('decomposeColor', () => {
    it('converts an rgb color string to an object with `type` and `value` keys', () => {
      const { type, values } = decomposeColor('rgb(255, 255, 255)');
      expect(type).toEqual('rgb');
      expect(values).toEqual([255, 255, 255]);
    });

    it('converts an rgba color string to an object with `type` and `value` keys', () => {
      const { type, values } = decomposeColor('rgba(255, 255, 255, 0.5)');
      expect(type).toEqual('rgba');
      expect(values).toEqual([255, 255, 255, 0.5]);
    });

    it('converts an hsl color string to an object with `type` and `value` keys', () => {
      const { type, values } = decomposeColor('hsl(100, 50%, 25%)');
      expect(type).toEqual('hsl');
      expect(values).toEqual([100, 50, 25]);
    });

    it('converts an hsla color string to an object with `type` and `value` keys', () => {
      const { type, values } = decomposeColor('hsla(100, 50%, 25%, 0.5)');
      expect(type).toEqual('hsla');
      expect(values).toEqual([100, 50, 25, 0.5]);
    });

    it('converts CSS4 color with color space display-3', () => {
      const { type, values, colorSpace } = decomposeColor('color(display-p3 0 1 0)');
      expect(type).toEqual('color');
      expect(colorSpace).toEqual('display-p3');
      expect(values).toEqual([0, 1, 0]);
    });

    it('converts an alpha CSS4 color with color space display-3', () => {
      const { type, values, colorSpace } = decomposeColor('color(display-p3 0 1 0 /0.4)');
      expect(type).toEqual('color');
      expect(colorSpace).toEqual('display-p3');
      expect(values).toEqual([0, 1, 0, 0.4]);
    });

    it('should throw error with inexistent color color space', () => {
      const decimposeWithError = () => decomposeColor('color(foo 0 1 0)');
      expect(decimposeWithError).toThrow();
    });

    it('idempotent', () => {
      const output1 = decomposeColor('hsla(100, 50%, 25%, 0.5)');
      const output2 = decomposeColor(output1);
      expect(output1).toEqual(output2);
    });

    it('converts rgba hex', () => {
      const decomposed = decomposeColor('#111111f8');
      expect(decomposed).toEqual({
        type: 'rgba',
        colorSpace: undefined,
        values: [17, 17, 17, 0.973],
      });
    });
  });

  describe('getContrastRatio', () => {
    it('returns a ratio for black : white', () => {
      expect(getContrastRatio('#000', '#FFF')).toEqual(21);
    });

    it('returns a ratio for black : black', () => {
      expect(getContrastRatio('#000', '#000')).toEqual(1);
    });

    it('returns a ratio for white : white', () => {
      expect(getContrastRatio('#FFF', '#FFF')).toEqual(1);
    });

    it('Can also take into account opacity for background', () => {
      expect(getContrastRatio('#FFF', 'rgba(255,255,255,0.1)', '#000')).toEqual(17.5);
    });

    it('returns a ratio for dark-grey : light-grey', () => {
      //expect(getContrastRatio('#707070', '#E5E5E5'))to.be.approximately(3.93, 0.01);
    });

    it('returns a ratio for black : light-grey', () => {
      //expect(getContrastRatio('#000', '#888')).to.be.approximately(5.92, 0.01);
    });
  });

  describe('getLuminance', () => {
    it('returns a valid luminance for rgb black', () => {
      expect(getLuminance('rgba(0, 0, 0)')).toEqual(0);
      expect(getLuminance('rgb(0, 0, 0)')).toEqual(0);
      expect(getLuminance('color(display-p3 0 0 0)')).toEqual(0);
    });

    it('returns a valid luminance for rgb white', () => {
      expect(getLuminance('rgba(255, 255, 255)')).toEqual(1);
      expect(getLuminance('rgb(255, 255, 255)')).toEqual(1);
    });

    it('returns a valid luminance for rgb mid-grey', () => {
      expect(getLuminance('rgba(127, 127, 127)')).toEqual(0.212);
      expect(getLuminance('rgb(127, 127, 127)')).toEqual(0.212);
    });

    it('returns a valid luminance for an rgb color', () => {
      expect(getLuminance('rgb(255, 127, 0)')).toEqual(0.364);
    });

    it('returns a valid luminance from an hsl color', () => {
      expect(getLuminance('hsl(100, 100%, 50%)')).toEqual(0.735);
    });

    it('returns an equal luminance for the same color in different formats', () => {
      const hsl = 'hsl(100, 100%, 50%)';
      const rgb = 'rgb(85, 255, 0)';
      expect(getLuminance(hsl)).toEqual(getLuminance(rgb));
    });

    it('returns a valid luminance from an CSS4 color', () => {
      expect(getLuminance('color(display-p3 1 1 0.1)')).toEqual(0.929);
    });

    it('throw on invalid colors', () => {
      expect(() => {
        getLuminance('black');
      }).toThrowError(/Unsupported 'black' color/);
    });
  });

  describe('emphasize', () => {
    it('lightens a dark rgb color with the coefficient provided', () => {
      expect(emphasize('rgb(1, 2, 3)', 0.4)).toEqual(lighten('rgb(1, 2, 3)', 0.4));
    });

    it('darkens a light rgb color with the coefficient provided', () => {
      expect(emphasize('rgb(250, 240, 230)', 0.3)).toEqual(darken('rgb(250, 240, 230)', 0.3));
    });

    it('lightens a dark rgb color with the coefficient 0.15 by default', () => {
      expect(emphasize('rgb(1, 2, 3)')).toEqual(lighten('rgb(1, 2, 3)', 0.15));
    });

    it('darkens a light rgb color with the coefficient 0.15 by default', () => {
      expect(emphasize('rgb(250, 240, 230)')).toEqual(darken('rgb(250, 240, 230)', 0.15));
    });

    it('lightens a dark CSS4 color with the coefficient 0.15 by default', () => {
      expect(emphasize('color(display-p3 0.1 0.1 0.1)')).toEqual(lighten('color(display-p3 0.1 0.1 0.1)', 0.15));
    });

    it('darkens a light CSS4 color with the coefficient 0.15 by default', () => {
      expect(emphasize('color(display-p3 1 1 0.1)')).toEqual(darken('color(display-p3 1 1 0.1)', 0.15));
    });
  });

  describe('alpha', () => {
    it('converts an rgb color to an rgba color with the value provided', () => {
      expect(alpha('rgb(1, 2, 3)', 0.4)).toEqual('rgb(1, 2, 3, 0.4)');
    });

    it('updates an CSS4 color with the alpha value provided', () => {
      expect(alpha('color(display-p3 1 2 3)', 0.4)).toEqual('color(display-p3 1 2 3 /0.4)');
    });

    it('updates an rgba color with the alpha value provided', () => {
      expect(alpha('rgba(255, 0, 0, 0.2)', 0.5)).toEqual('rgba(255, 0, 0, 0.5)');
    });

    it('converts an hsl color to an hsla color with the value provided', () => {
      expect(alpha('hsl(0, 100%, 50%)', 0.1)).toEqual('hsl(0, 100%, 50%, 0.1)');
    });

    it('updates an hsla color with the alpha value provided', () => {
      expect(alpha('hsla(0, 100%, 50%, 0.2)', 0.5)).toEqual('hsla(0, 100%, 50%, 0.5)');
    });

    it('converts an #rrggbb hex color with the alpha value provided', () => {
      expect(alpha('#FFFFFF', 0)).toEqual('#FFFFFF00');
    });

    it('converts an #rgb color with the alpha value provided', () => {
      expect(alpha('#fff', 0.5)).toEqual('#ffffff80');
    });

    it('converts an #rgba color with the alpha value provided', () => {
      expect(alpha('#ffff', 0.5)).toEqual('#ffffff80');
    });

    it('throw on invalid colors', () => {
      expect(() => {
        alpha('white', 0.4);
      }).toThrowError(/Unsupported 'white' color/);
    });
  });

  describe('darken', () => {
    it("doesn't modify rgb black", () => {
      expect(darken('rgb(0, 0, 0)', 0.1)).toEqual('rgb(0, 0, 0)');
    });

    it("doesn't overshoot if an above-range coefficient is supplied", () => {
      expect(darken('rgb(0, 127, 255)', 1.5)).toEqual('rgb(0, 0, 0)');
      expect(consoleErrorMock).toHaveBeenCalledWith('The value provided 1.5 is out of range [0, 1].');
    });

    it("doesn't overshoot if a below-range coefficient is supplied", () => {
      expect(darken('rgb(0, 127, 255)', -0.1)).toEqual('rgb(0, 127, 255)');
      expect(consoleErrorMock).toHaveBeenCalledWith('The value provided 1.5 is out of range [0, 1].');
    });

    it('darkens rgb white to black when coefficient is 1', () => {
      expect(darken('rgb(255, 255, 255)', 1)).toEqual('rgb(0, 0, 0)');
    });

    it('retains the alpha value in an rgba color', () => {
      expect(darken('rgb(0, 0, 0, 0.5)', 0.1)).toEqual('rgb(0, 0, 0, 0.5)');
    });

    it('darkens rgb white by 10% when coefficient is 0.1', () => {
      expect(darken('rgb(255, 255, 255)', 0.1)).toEqual('rgb(229, 229, 229)');
    });

    it('darkens rgb red by 50% when coefficient is 0.5', () => {
      expect(darken('rgb(255, 0, 0)', 0.5)).toEqual('rgb(127, 0, 0)');
    });

    it('darkens rgb grey by 50% when coefficient is 0.5', () => {
      expect(darken('rgb(127, 127, 127)', 0.5)).toEqual('rgb(63, 63, 63)');
    });

    it("doesn't modify rgb colors when coefficient is 0", () => {
      expect(darken('rgb(255, 255, 255)', 0)).toEqual('rgb(255, 255, 255)');
    });

    it('darkens hsl red by 50% when coefficient is 0.5', () => {
      expect(darken('hsl(0, 100%, 50%)', 0.5)).toEqual('hsl(0, 100%, 25%)');
    });

    it("doesn't modify hsl colors when coefficient is 0", () => {
      expect(darken('hsl(0, 100%, 50%)', 0)).toEqual('hsl(0, 100%, 50%)');
    });

    it("doesn't modify hsl colors when l is 0%", () => {
      expect(darken('hsl(0, 50%, 0%)', 0.5)).toEqual('hsl(0, 50%, 0%)');
    });

    it('darkens CSS4 color red by 50% when coefficient is 0.5', () => {
      expect(darken('color(display-p3 1 0 0)', 0.5)).toEqual('color(display-p3 0.5 0 0)');
    });

    it("doesn't modify CSS4 color when coefficient is 0", () => {
      expect(darken('color(display-p3 1 0 0)', 0)).toEqual('color(display-p3 1 0 0)');
    });
  });

  describe('lighten', () => {
    it("doesn't modify rgb white", () => {
      expect(lighten('rgb(255, 255, 255)', 0.1)).toEqual('rgb(255, 255, 255)');
    });

    it("doesn't overshoot if an above-range coefficient is supplied", () => {
      expect(lighten('rgb(0, 127, 255)', 1.5)).toEqual('rgb(255, 255, 255)');
    });

    it("doesn't overshoot if a below-range coefficient is supplied", () => {
      expect(lighten('rgb(0, 127, 255)', -0.1)).toEqual('rgb(0, 127, 255)');
    });

    it('lightens rgb black to white when coefficient is 1', () => {
      expect(lighten('rgb(0, 0, 0)', 1)).toEqual('rgb(255, 255, 255)');
    });

    it('retains the alpha value in an rgba color', () => {
      expect(lighten('rgb(255, 255, 255, 0.5)', 0.1)).toEqual('rgb(255, 255, 255, 0.5)');
    });

    it('lightens rgb black by 10% when coefficient is 0.1', () => {
      expect(lighten('rgb(0, 0, 0)', 0.1)).toEqual('rgb(25, 25, 25)');
    });

    it('lightens rgb red by 50% when coefficient is 0.5', () => {
      expect(lighten('rgb(255, 0, 0)', 0.5)).toEqual('rgb(255, 127, 127)');
    });

    it('lightens rgb grey by 50% when coefficient is 0.5', () => {
      expect(lighten('rgb(127, 127, 127)', 0.5)).toEqual('rgb(191, 191, 191)');
    });

    it("doesn't modify rgb colors when coefficient is 0", () => {
      expect(lighten('rgb(127, 127, 127)', 0)).toEqual('rgb(127, 127, 127)');
    });

    it('lightens hsl red by 50% when coefficient is 0.5', () => {
      expect(lighten('hsl(0, 100%, 50%)', 0.5)).toEqual('hsl(0, 100%, 75%)');
    });

    it("doesn't modify hsl colors when coefficient is 0", () => {
      expect(lighten('hsl(0, 100%, 50%)', 0)).toEqual('hsl(0, 100%, 50%)');
    });

    it("doesn't modify hsl colors when `l` is 100%", () => {
      expect(lighten('hsl(0, 50%, 100%)', 0.5)).toEqual('hsl(0, 50%, 100%)');
    });

    it('lightens CSS4 color red by 50% when coefficient is 0.5', () => {
      expect(lighten('color(display-p3 1 0 0)', 0.5)).toEqual('color(display-p3 1 0.5 0.5)');
    });

    it("doesn't modify CSS4 color when coefficient is 0", () => {
      expect(lighten('color(display-p3 1 0 0)', 0)).toEqual('color(display-p3 1 0 0)');
    });
  });

  describe('asRgbString', () => {
    it('should convert hex color to rgb', () => {
      expect(asRgbString('#FFFFFF')).toEqual('rgb(255, 255, 255)');
      expect(asRgbString('#000000')).toEqual('rgb(0, 0, 0)');
    });
  });

  describe('onBackground', () => {
    it('should calculate the foreground color given a background color', () => {
      expect(onBackground('#ffffff', '#000').toHexString()).toBe('#ffffff');
      expect(onBackground('#ffffff00', '#000').toHexString()).toBe('#000000');
      expect(onBackground('#ffffff77', '#000').toHexString()).toBe('#777777');
      expect(onBackground('#262a6d82', '#644242').toHexString()).toBe('#443658');
      expect(onBackground('rgba(255,0,0,0.5)', 'rgba(0,255,0,0.5)').toRgbString()).toBe('rgba(170, 85, 0, 0.75)');
      expect(onBackground('rgba(255,0,0,0.5)', 'rgba(0,0,255,1)').toRgbString()).toBe('rgb(128, 0, 128)');
      expect(onBackground('rgba(0,0,255,1)', 'rgba(0,0,0,0.5)').toRgbString()).toBe('rgb(0, 0, 255)');
    });
  });
});
