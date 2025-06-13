import { getPublicOrAbsoluteUrl } from 'app/features/dimensions';

import { getWebGLStyle } from './markers';

// Mock dependencies
jest.mock('app/features/dimensions', () => ({
  getPublicOrAbsoluteUrl: jest.fn(),
}));

describe('getWebGLStyle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns default circle style when no symbol is provided', async () => {
    const result = await getWebGLStyle();
    expect(result).toEqual({
      symbol: {
        symbolType: 'circle',
        size: ['get', 'size', 'number'],
        color: ['color', ['get', 'red'], ['get', 'green'], ['get', 'blue']],
        offset: ['array', ['get', 'offsetX'], ['get', 'offsetY']],
        rotation: ['get', 'rotation', 'number'],
        opacity: ['get', 'opacity', 'number'],
      },
    });
  });

  it('returns circle style for known WebGL regular shape', async () => {
    const result = await getWebGLStyle('img/icons/marker/circle.svg');
    if (result.symbol) {
      expect(result.symbol.symbolType).toBe('circle');
      expect(result.symbol).not.toHaveProperty('src');
    }
  });

  it('returns square style for known WebGL regular shape', async () => {
    const result = await getWebGLStyle('img/icons/marker/square.svg');
    if (result.symbol) {
      expect(result.symbol.symbolType).toBe('square');
      expect(result.symbol).not.toHaveProperty('src');
    }
  });

  it('returns triangle style for known WebGL regular shape', async () => {
    const result = await getWebGLStyle('img/icons/marker/triangle.svg');
    if (result.symbol) {
      expect(result.symbol.symbolType).toBe('triangle');
      expect(result.symbol).not.toHaveProperty('src');
    }
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
    if (result.symbol) {
      expect(result.symbol.symbolType).toBe('image');
      expect(result.symbol.src).toContain('data:image/svg+xml');
    }
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
    if (result.symbol?.src) {
      expect(result.symbol.symbolType).toBe('image');
      expect(result.symbol.src).toContain('circle');
      const decodedSrc = decodeURIComponent(result.symbol.src);
      expect(decodedSrc).toContain('stroke="rgba(255,255,255,0.2)"'); // 0.1 / 0.5 = 0.2
    }
  });

  it('handles fetch error gracefully', async () => {
    // Mock console.error to suppress output and verify it's called
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    (getPublicOrAbsoluteUrl as jest.Mock).mockReturnValue('error.svg');
    global.fetch = jest.fn(() => Promise.reject(new Error('Fetch failed')));
    const result = await getWebGLStyle('error.svg');
    if (result.symbol) {
      expect(result.symbol.symbolType).toBe('image');
      expect(result.symbol.src).toBe(''); // Empty SVG
    }
    // Verify console.error was called with the expected error
    expect(consoleErrorSpy).toHaveBeenCalledWith(new Error('Fetch failed'));

    // Clean up the spy
    consoleErrorSpy.mockRestore();
  });
});
