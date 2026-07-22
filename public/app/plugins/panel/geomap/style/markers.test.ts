import { Fill, Stroke } from 'ol/style';

import { getPublicOrAbsoluteUrl } from 'app/features/dimensions/resource';

import {
  getWebGLStyle,
  baseCircleStyle,
  baseShapeStyle,
  sizeExpression,
  opacityExpression,
  rotationExpression,
  offsetExpression,
  getMarkerMaker,
  circleMarker,
  getFillColor,
  getStrokeStyle,
  getMarkerAsPath,
  textMarker,
  polyStyle,
  routeStyle,
} from './markers';
import { defaultStyleConfig } from './types';

// Mock dependencies
jest.mock('app/features/dimensions/resource', () => ({
  getPublicOrAbsoluteUrl: jest.fn(),
}));

describe('getWebGLStyle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns default circle style when no symbol is provided', async () => {
    const result = await getWebGLStyle();
    expect(result).toEqual(baseCircleStyle);
  });

  it('returns circle style for known WebGL regular shape', async () => {
    const result = await getWebGLStyle('img/icons/marker/circle.svg');
    expect(result).toEqual(baseCircleStyle);
  });

  it('returns shape style for square WebGL regular shape', async () => {
    const result = await getWebGLStyle('img/icons/marker/square.svg');
    expect(result).toEqual({
      ...baseShapeStyle,
      'shape-points': 4,
      'shape-angle': Math.PI / 4,
    });
  });

  it('returns shape style for triangle WebGL regular shape', async () => {
    const result = await getWebGLStyle('img/icons/marker/triangle.svg');
    expect(result).toEqual({
      ...baseShapeStyle,
      'shape-points': 3,
      'shape-angle': 0,
    });
  });

  it('returns image style with src for custom SVG symbol', async () => {
    (getPublicOrAbsoluteUrl as jest.Mock).mockReturnValue('test.svg');
    global.fetch = jest.fn(() =>
      Promise.resolve({
        text: () => Promise.resolve('<svg width="100" height="100"></svg>'),
        // Add minimal Response properties to satisfy TypeScript
        ok: true,
        status: 200,
        headers: new Headers(),
      } as Response)
    );
    const result = await getWebGLStyle('test.svg');
    expect(result['icon-src']).toContain('data:image/svg+xml');
    expect(result['icon-width']).toEqual(sizeExpression);
    expect(result['icon-height']).toEqual(sizeExpression);
    expect(result['icon-opacity']).toEqual(opacityExpression);
    expect(result['icon-rotation']).toEqual(rotationExpression);
    expect(result['icon-displacement']).toEqual(offsetExpression);
  });

  it('includes background circle with opacity-adjusted stroke when opacity is provided', async () => {
    (getPublicOrAbsoluteUrl as jest.Mock).mockReturnValue('custom.svg');
    global.fetch = jest.fn(() =>
      Promise.resolve({
        text: () => Promise.resolve('<svg width="100" height="100" viewBox="0 0 100 100"></svg>'),
        ok: true,
        status: 200,
        headers: new Headers(),
      } as Response)
    );
    const result = await getWebGLStyle('custom.svg', 0.5);
    const iconSrc = result['icon-src'] as string;
    expect(iconSrc).toContain('circle');
    const decodedSrc = decodeURIComponent(iconSrc);
    expect(decodedSrc).toContain('stroke="rgba(255,255,255,0.2)"'); // 0.1 / 0.5 = 0.2
  });

  it('handles fetch error gracefully', async () => {
    // Mock console.error to suppress output and verify it's called
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    (getPublicOrAbsoluteUrl as jest.Mock).mockReturnValue('error.svg');
    global.fetch = jest.fn(() => Promise.reject(new Error('Fetch failed')));
    const result = await getWebGLStyle('error.svg');
    expect(result['icon-src']).toBe(''); // Empty SVG

    // Verify console.error was called with the expected error
    expect(consoleErrorSpy).toHaveBeenCalledWith(new Error('Fetch failed'));

    // Clean up the spy
    consoleErrorSpy.mockRestore();
  });
});

describe('Icon Path Consistency', () => {
  const circleIconPath = 'img/icons/marker/circle.svg';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should use consistent paths between default and selected circle icons', () => {
    expect(defaultStyleConfig.symbol.fixed).toBe(circleIconPath);
  });

  it('should handle default and explicitly selected circle icons the same way for WebGL style', async () => {
    const defaultStyle = await getWebGLStyle(); // No symbol
    const explicitCircleStyle = await getWebGLStyle(circleIconPath);

    expect(explicitCircleStyle).toEqual(defaultStyle);
  });

  it('should create valid marker maker for default icon', async () => {
    const defaultMaker = await getMarkerMaker(); // No symbol

    expect(defaultMaker).toBe(circleMarker);
  });
});

describe('getFillColor', () => {
  it('returns a solid Fill when opacity is 1', () => {
    const fill = getFillColor({ color: '#37872d', opacity: 1 });
    expect(fill).toBeInstanceOf(Fill);
    expect(fill?.getColor()).toBe('#37872d');
  });

  it('applies alpha via tinycolor when opacity is between 0 and 1', () => {
    const fill = getFillColor({ color: '#37872d', opacity: 0.5 });
    expect(fill).toBeInstanceOf(Fill);
    // tinycolor's rgba string includes the alpha channel.
    expect(String(fill?.getColor())).toMatch(/rgba\(.*0\.5\)/);
  });

  it('returns undefined when opacity is 0', () => {
    expect(getFillColor({ color: '#37872d', opacity: 0 })).toBeUndefined();
  });
});

describe('getStrokeStyle', () => {
  it('returns a Stroke with the configured color and lineWidth at opacity 1', () => {
    const stroke = getStrokeStyle({ color: '#000', opacity: 1, lineWidth: 3 });
    expect(stroke).toBeInstanceOf(Stroke);
    expect(stroke?.getColor()).toBe('#000');
    expect(stroke?.getWidth()).toBe(3);
  });

  it('applies opacity via tinycolor when opacity is between 0 and 1', () => {
    const stroke = getStrokeStyle({ color: '#000', opacity: 0.25 });
    expect(stroke).toBeInstanceOf(Stroke);
    expect(String(stroke?.getColor())).toMatch(/rgba\(.*0\.25\)/);
    // lineWidth defaults to 1 when not supplied.
    expect(stroke?.getWidth()).toBe(1);
  });
});

describe('getMarkerAsPath', () => {
  it('returns the icon path for a known marker shape and undefined for an unknown one', () => {
    const known = getMarkerAsPath('circle');
    expect(typeof known).toBe('string');
    expect(known).toMatch(/\.svg$/);

    expect(getMarkerAsPath('not-a-marker-shape')).toBeUndefined();
  });
});

describe('textMarker', () => {
  it('sets the text label to the provided string', () => {
    const style = textMarker({ color: '#ff0000', opacity: 1, text: 'hello' });
    expect(style.getText()?.getText()).toBe('hello');
  });

  it('has no text label when text is not provided', () => {
    const style = textMarker({ color: '#ff0000', opacity: 1 });
    expect(style.getText()).toBeNull();
  });
});

describe('polyStyle', () => {
  it('returns a Style with fill and stroke', () => {
    const { Style, Stroke } = require('ol/style');
    const style = polyStyle({ color: '#0000ff', opacity: 0.5, lineWidth: 2 });
    expect(style).toBeInstanceOf(Style);
    expect(style.getStroke()).toBeInstanceOf(Stroke);
  });
});

describe('routeStyle', () => {
  it('returns a Style with a stroke', () => {
    const { Style, Stroke } = require('ol/style');
    const style = routeStyle({ color: '#00ff00', opacity: 1, lineWidth: 3 });
    expect(style).toBeInstanceOf(Style);
    expect(style.getStroke()).toBeInstanceOf(Stroke);
  });

  it('returns a Style with no stroke when opacity is 0', () => {
    const { Style } = require('ol/style');
    const style = routeStyle({ color: '#00ff00', opacity: 0 });
    expect(style).toBeInstanceOf(Style);
    expect(style.getStroke()).toBeNull();
  });
});

describe('shape marker makers', () => {
  const baseCfg = { color: '#ff0000', opacity: 0.8, lineWidth: 2, size: 12, rotation: 45 };

  it.each(['circle', 'square', 'triangle', 'star', 'cross', 'x'])(
    'getMarkerMaker resolves and make() returns a Style for shape "%s"',
    async (shapeId) => {
      const { Style } = require('ol/style');
      const path = getMarkerAsPath(shapeId);
      expect(path).toBeDefined();
      const maker = await getMarkerMaker(path!);
      const result = maker(baseCfg);
      const styles = Array.isArray(result) ? result : [result];
      expect(styles.length).toBeGreaterThan(0);
      for (const s of styles) {
        expect(s).toBeInstanceOf(Style);
      }
    }
  );

  it('maker uses default size when cfg.size is not set', async () => {
    const { Style } = require('ol/style');
    const maker = await getMarkerMaker(getMarkerAsPath('square')!);
    const result = maker({ color: '#000', opacity: 1 });
    expect(result).toBeInstanceOf(Style);
  });
});
