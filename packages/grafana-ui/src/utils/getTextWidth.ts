let canvas: HTMLCanvasElement | null;
const cache: Record<string, number> = {};

export function getTextWidth(text: string, fontSize: number): number {
  const fontStyle = `${fontSize}px 'Roboto'`;
  const cacheKey = text + fontStyle;
  const fromCache = cache[cacheKey];

  if (fromCache) {
    console.log('using cache', fromCache);
    return fromCache;
  }

  canvas = canvas ?? document.createElement('canvas');
  const context = canvas.getContext('2d');
  context.font = fontStyle;
  const metrics = context.measureText(text);

  cache[cacheKey] = metrics.width + 15;
  return metrics.width + 15;
}
