import { BusEventWithPayload, GrafanaTheme2 } from '@grafana/data';

import { ProcessedLogModel } from './processing';

let ctx: CanvasRenderingContext2D | null = null;
let lineHeight: number | null = null;

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
  lineHeight = theme.typography.fontSize * theme.typography.body.lineHeight;
  return true;
}

export function measureTextWidth(text: string) {
  if (!ctx || !lineHeight) {
    throw new Error(`Measuring context canvas is not initialized. Call init() before.`);
  }
  return ctx.measureText(text).width;
}

export function measureTextHeight(text: string, maxWidth: number, beforeWidth = 0) {
  if (!lineHeight) {
    throw new Error(`Measuring context canvas is not initialized. Call init() before.`);
  }

  let logLines = 0;
  const charWidth = measureTextWidth('ee') / 2;
  let logLineCharsLength = Math.round(maxWidth / charWidth);
  const firstLineCharsLength = Math.floor((maxWidth - beforeWidth) / charWidth) - 2 * charWidth;
  const textLines = text.split('\n');

  // Skip unnecessary measurements
  if (textLines.length === 1 && text.length < firstLineCharsLength) {
    return {
      lines: 1,
      height: lineHeight,
    };
  }

  for (const textLine of textLines) {
    for (let start = 0; start < textLine.length; ) {
      let testLogLine: string;
      let width = 0;
      let delta = 0;
      let availableWidth = maxWidth - beforeWidth - charWidth;
      do {
        testLogLine = textLine.substring(start, start + logLineCharsLength - delta);
        width = measureTextWidth(testLogLine);
        delta += 1;
      } while (width >= availableWidth);
      if (beforeWidth) {
        //console.log(testLogLine)
        beforeWidth = 0;
      }
      logLines += 1;
      start += testLogLine.length;
    }
  }

  const height = logLines * lineHeight;

  return {
    lines: logLines,
    height,
  };
}

interface DisplayOptions {
  wrap: boolean;
  showTime: boolean;
}

export function getLogLineSize(
  logs: ProcessedLogModel[],
  container: HTMLDivElement | null,
  { wrap, showTime }: DisplayOptions,
  index: number
) {
  if (!lineHeight) {
    throw new Error(`Measuring context canvas is not initialized. Call init() before.`);
  }
  if (!container) {
    return 0;
  }
  if (!wrap) {
    return lineHeight;
  }
  const storedSize = retrieveLogLineSize(logs[index].uid, container);
  if (storedSize) {
    return storedSize;
  }
  const gap = 8;
  let optionsWidth = 0;
  if (showTime) {
    optionsWidth += logs[index].dimensions.timestampWidth + gap;
  }
  if (logs[index].logLevel) {
    optionsWidth += logs[index].dimensions.levelWidth + gap;
  }
  const { height } = measureTextHeight(logs[index].body, getLogContainerWidth(container), optionsWidth);
  return height;
}

const scrollBarWidth = getScrollbarWidth();

export function getLogContainerWidth(container: HTMLDivElement) {
  return container.clientWidth - scrollBarWidth;
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

const logLineSizesMap = new Map<string, number>();

export function storeLogLineSize(id: string, container: HTMLDivElement, height: number) {
  const key = `${id}_${getLogContainerWidth(container)}`;
  logLineSizesMap.set(key, height);
}

export function retrieveLogLineSize(id: string, container: HTMLDivElement) {
  const key = `${id}_${getLogContainerWidth(container)}`;
  return logLineSizesMap.get(key);
}

export interface ScrollToLogsEventPayload {
  scrollTo: 'top' | 'bottom';
}

export class ScrollToLogsEvent extends BusEventWithPayload<ScrollToLogsEventPayload> {
  static type = 'logs-panel-scroll-to';
}
