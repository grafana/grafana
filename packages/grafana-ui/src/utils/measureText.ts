let canvas: HTMLCanvasElement | null;
const cache: Record<string, TextMetrics> = {};

export function measureText(text: string, fontSize: number): TextMetrics {
  const fontStyle = `${fontSize}px 'Roboto'`;
  const cacheKey = text + fontStyle;
  const fromCache = cache[cacheKey];

  if (fromCache) {
    return fromCache;
  }

  canvas = canvas ?? document.createElement('canvas');
  const context = canvas.getContext('2d');
  context.font = fontStyle;
  const metrics = context.measureText(text);

  cache[cacheKey] = metrics;
  return metrics;
}
