let canvas: HTMLCanvasElement | null = null;
const cache: Record<string, TextMetrics> = {};

export function measureText(text: string, fontSize: number): TextMetrics {
  const fontStyle = `${fontSize}px 'Roboto'`;
  const cacheKey = text + fontStyle;
  const fromCache = cache[cacheKey];

  if (fromCache) {
    return fromCache;
  }

  if (canvas === null) {
    canvas = document.createElement('canvas');
  }

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Could not create context');
  }

  context.font = fontStyle;
  const metrics = context.measureText(text);

  cache[cacheKey] = metrics;
  return metrics;
}
