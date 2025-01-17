import { BusEventWithPayload, GrafanaTheme2 } from '@grafana/data';

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

  let logLines = 0;
  const charWidth = ctx.measureText('a').width;
  let logLineCharsWidth = Math.round(maxWidth / charWidth);
  const textLines = text.split('\n');
  for (const textLine of textLines) {
    for (let start = 0; start < textLine.length; ) {
      let testLogLine: string;
      let metrics: TextMetrics;
      let delta = 0;
      do {
        testLogLine = textLine.substring(start, start + logLineCharsWidth - delta);
        metrics = ctx.measureText(testLogLine);
        delta += 1;
      } while (metrics.width >= maxWidth);
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
  const storedSize = retrieveLogLineSize(logs[index].uid, container);
  if (storedSize) {
    return storedSize;
  }
  const lineHeight = theme.typography.fontSize * theme.typography.body.lineHeight;
  if (!wrapLogMessage) {
    return lineHeight;
  }
  const { height } = measureText(logs[index].body, getLogContainerWidth(container), lineHeight);
  return height;
}

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
