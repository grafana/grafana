import { ResourceDimensionMode, TextDimensionMode } from '@grafana/schema';

import { HorizontalAlign, VerticalAlign, type StyleConfig, type SymbolAlign } from './types';
import { getDisplacement, getRGBValues, getStyleConfigState, styleUsesText } from './utils';

describe('style utils', () => {
  it('should fill in default values', async () => {
    const cfg: StyleConfig = {
      color: {
        field: 'Price',
        fixed: 'dark-green',
      },
      opacity: 0.4,
      size: {
        field: 'Count',
        fixed: 5,
        max: 15,
        min: 2,
      },
      symbol: {
        fixed: 'img/icons/marker/star.svg',
        mode: ResourceDimensionMode.Fixed, // 'fixed',
      },
      textConfig: {
        fontSize: 12,
        offsetX: 0,
        offsetY: 0,
        // textAlign: 'center',
        // textBaseline: 'middle',
      },
    };

    const state = await getStyleConfigState(cfg);
    state.config = null as unknown as StyleConfig; // not interesting in the snapshot
    expect(state.hasText).toBe(false);
    expect(state).toMatchInlineSnapshot(`
      {
        "base": {
          "color": "#37872D",
          "lineWidth": 1,
          "opacity": 0.4,
          "rotation": 0,
          "size": 5,
          "symbolAlign": {
            "horizontal": "center",
            "vertical": "center",
          },
        },
        "config": null,
        "fields": {
          "color": "Price",
          "size": "Count",
        },
        "hasText": false,
        "maker": [Function],
      }
    `);
  });
  it('should return correct displacement array for top left', async () => {
    const symbolAlign: SymbolAlign = { horizontal: HorizontalAlign.Left, vertical: VerticalAlign.Top };
    const radius = 10;
    const displacement = getDisplacement(symbolAlign, radius);
    expect(displacement).toEqual([-10, 10]);
  });
  it('should return correct displacement array for bottom right', async () => {
    const symbolAlign: SymbolAlign = { horizontal: HorizontalAlign.Right, vertical: VerticalAlign.Bottom };
    const radius = 10;
    const displacement = getDisplacement(symbolAlign, radius);
    expect(displacement).toEqual([10, -10]);
  });
  it('should return correct displacement array for center center', async () => {
    const symbolAlign: SymbolAlign = { horizontal: HorizontalAlign.Center, vertical: VerticalAlign.Center };
    const radius = 10;
    const displacement = getDisplacement(symbolAlign, radius);
    expect(displacement).toEqual([0, 0]);
  });
  it('should return correct color values for hex default color', async () => {
    const colorString = '#37872d';
    const colorValues = getRGBValues(colorString);
    expect(colorValues).toEqual({ r: 55, g: 135, b: 45 });
  });
  it('should return correct color values for rgb color', async () => {
    const colorString = 'rgb(242, 73, 92)';
    const colorValues = getRGBValues(colorString);
    expect(colorValues).toEqual({ r: 242, g: 73, b: 92 });
  });
  it('should return correct color values for rgba color', async () => {
    const colorString = 'rgba(90, 0, 135, 0.5)';
    const colorValues = getRGBValues(colorString);
    expect(colorValues).toEqual({ r: 90, g: 0, b: 135, a: 0.5 });
  });
  it('should return correct color values for transparent color', async () => {
    const colorString = 'rgba(0, 0, 0, 0)';
    const colorValues = getRGBValues(colorString);
    expect(colorValues).toEqual({ r: 0, g: 0, b: 0, a: 0 });
  });

  describe('styleUsesText', () => {
    it('returns false when text is undefined', () => {
      expect(styleUsesText({} as StyleConfig)).toBe(false);
    });

    it('returns false when text.mode is Fixed but fixed value is empty', () => {
      expect(styleUsesText({ text: { mode: TextDimensionMode.Fixed, fixed: '' } } as StyleConfig)).toBe(false);
    });

    it('returns true when text.mode is Fixed and a fixed value is set', () => {
      expect(styleUsesText({ text: { mode: TextDimensionMode.Fixed, fixed: 'hello' } } as StyleConfig)).toBe(true);
    });

    it('returns true when text.mode is Field and a field is set', () => {
      expect(styleUsesText({ text: { mode: TextDimensionMode.Field, fixed: '', field: 'name' } } as StyleConfig)).toBe(
        true
      );
    });
  });

  describe('getDisplacement — full alignment grid', () => {
    const radius = 10;
    it.each([
      // horizontal: Left
      [{ horizontal: HorizontalAlign.Left, vertical: VerticalAlign.Top }, [-10, 10]],
      [{ horizontal: HorizontalAlign.Left, vertical: VerticalAlign.Center }, [-10, 0]],
      [{ horizontal: HorizontalAlign.Left, vertical: VerticalAlign.Bottom }, [-10, -10]],
      // horizontal: Center
      [{ horizontal: HorizontalAlign.Center, vertical: VerticalAlign.Top }, [0, 10]],
      [{ horizontal: HorizontalAlign.Center, vertical: VerticalAlign.Bottom }, [0, -10]],
      // horizontal: Right
      [{ horizontal: HorizontalAlign.Right, vertical: VerticalAlign.Top }, [10, 10]],
      [{ horizontal: HorizontalAlign.Right, vertical: VerticalAlign.Center }, [10, 0]],
    ])('aligns %o to %j', (symbolAlign: SymbolAlign, expected: number[]) => {
      expect(getDisplacement(symbolAlign, radius)).toEqual(expected);
    });
  });

  describe('getStyleConfigState — missing branches', () => {
    it('uses defaultStyleConfig when called with no argument', async () => {
      const state = await getStyleConfigState();
      expect(state.config).toBeDefined();
      expect(state.hasText).toBe(false);
    });

    it('sets fields.rotation when config has a rotation field', async () => {
      const cfg: StyleConfig = {
        rotation: { field: 'bearing', fixed: 0, min: -180, max: 180 },
      };
      const state = await getStyleConfigState(cfg);
      expect(state.fields?.rotation).toBe('bearing');
    });

    it('populates text state and fields.text when hasText is true with a field reference', async () => {
      const cfg: StyleConfig = {
        text: { mode: TextDimensionMode.Field, field: 'label', fixed: '' },
      };
      const state = await getStyleConfigState(cfg);
      expect(state.hasText).toBe(true);
      expect(state.fields?.text).toBe('label');
      expect(state.base.textConfig).toBeDefined();
    });

    it('sets state.fields to undefined when no dynamic fields are configured', async () => {
      const cfg: StyleConfig = {};
      const state = await getStyleConfigState(cfg);
      expect(state.fields).toBeUndefined();
    });
  });

  describe('getRGBValues — extra parsing branches', () => {
    let warnSpy: jest.SpyInstance;
    beforeEach(() => {
      warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    });
    afterEach(() => {
      warnSpy.mockRestore();
    });

    it('parses rgba(...) with decimal alpha via parseFloat', () => {
      expect(getRGBValues('rgba(255, 128, 0, 0.5)')).toEqual({ r: 255, g: 128, b: 0, a: 0.5 });
    });

    it('parses rgb( ... ) tolerant of internal whitespace', () => {
      expect(getRGBValues('rgb( 255 , 128 , 0 )')).toEqual({ r: 255, g: 128, b: 0 });
    });

    it('returns null and warns for malformed rgb input', () => {
      expect(getRGBValues('rgb(')).toBeNull();
      expect(warnSpy).toHaveBeenCalled();
    });

    it('returns null and warns for 5+ value rgba inputs', () => {
      expect(getRGBValues('rgba(1, 2, 3, 4, 5)')).toBeNull();
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Unsupported color format'));
    });

    it('returns null and warns for non-hex / non-rgb color strings', () => {
      expect(getRGBValues('hsl(0, 100%, 50%)')).toBeNull();
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Unsupported color format'));
    });
  });
});
