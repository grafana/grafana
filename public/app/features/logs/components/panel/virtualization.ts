import { GrafanaTheme2 } from '@grafana/data';

let ctx: CanvasRenderingContext2D | null = null;

export function init(theme: GrafanaTheme2) {
  const letterSpacing = theme.typography.body.letterSpacing
    ? theme.typography.fontSize * parseFloat(theme.typography.body.letterSpacing)
    : undefined;
  const fontFamily = theme.typography.fontFamilyMonospace;
  const fontSize = theme.typography.fontSize;

  const canvas = document.createElement('canvas');
  ctx = canvas.getContext('2d');
  if (!ctx) {
    return false;
  }
  ctx.font = `${fontSize}px ${fontFamily}`;
  if (letterSpacing) {
    ctx.letterSpacing = `${letterSpacing}px`;
  }
  return true;
}

export function measureText(text: string, maxWidth: number, lineHeight: number) {
  if (!ctx) {
    throw new Error(`Measuring context canvas is not initialized. Call init() before.`);
  }

  let lines = 1;
  let line = '';
  let chars = text.split('');
  for (let i = 0; i < chars.length; i++) {
    if (chars[i] === '\n') {
      console.log(line);
      lines += 1;
      line = '';
      continue;
    }

    const testLine = line + chars[i];
    const metrics = ctx.measureText(testLine);

    if (Math.floor(metrics.width) > maxWidth) {
      console.log(line);
      lines += 1;
      line = chars[i];
    } else {
      line = testLine;
    }
  }

  const height = lines * lineHeight;

  return {
    lines,
    height,
  };
}
