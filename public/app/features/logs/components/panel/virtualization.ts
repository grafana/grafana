import { GrafanaTheme2 } from '@grafana/data';

import { ProcessedLogModel } from './processing';

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
    // chars[i+1] !== undefined means the \n is not the last character
    if (chars[i] === '\n' && chars[i + 1] !== undefined) {
      lines += 1;
      line = '';
      continue;
    }

    const testLine = line + chars[i];
    const metrics = ctx.measureText(testLine);

    if (metrics.width >= maxWidth) {
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

const scrollBarWidth = getScrollbarWidth();

export function getLogLineSize(
  logs: ProcessedLogModel[],
  container: HTMLDivElement | null,
  theme: GrafanaTheme2,
  wrapLogMessage: boolean,
  index: number
) {
  if (!container) {
    return 0;
  }
  const lineHeight = theme.typography.fontSize * theme.typography.body.lineHeight;
  if (!wrapLogMessage) {
    return lineHeight;
  }
  const { height } = measureText(logs[index].body, container.clientWidth - scrollBarWidth, lineHeight);
  return height;
}

export function getScrollbarWidth() {
  const hiddenDiv = document.createElement('div');

  hiddenDiv.style.width = '100px';
  hiddenDiv.style.height = '100px';
  hiddenDiv.style.overflow = 'scroll';
  hiddenDiv.style.position = 'absolute';
  hiddenDiv.style.top = '-9999px';

  document.body.appendChild(hiddenDiv);
  const width = hiddenDiv.offsetWidth - hiddenDiv.clientWidth;
  document.body.removeChild(hiddenDiv);

  return width;
}
