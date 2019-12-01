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

export function calculateFontSize(text: string, width: number, height: number, lineHeight: number, maxSize?: number) {
  // calculate width in 14px
  const textSize = measureText(text, 14);
  // how much bigger than 14px can we make it while staying within our width constraints
  const fontSizeBasedOnWidth = (width / (textSize.width + 2)) * 14;
  const fontSizeBasedOnHeight = height / lineHeight;

  // final fontSize
  const optimialSize = Math.min(fontSizeBasedOnHeight, fontSizeBasedOnWidth);
  return Math.min(optimialSize, maxSize ?? optimialSize);
}
