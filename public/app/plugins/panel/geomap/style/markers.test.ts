import { getPublicOrAbsoluteUrl } from 'app/features/dimensions/resource';

import {
  getWebGLStyle,
  baseCircleStyle,
  baseShapeStyle,
  sizeExpression,
  opacityExpression,
  rotationExpression,
  offsetExpression,
} from './markers';

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
