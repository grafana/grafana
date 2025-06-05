import ansicolor from 'ansicolor';

import { BusEventWithPayload, GrafanaTheme2 } from '@grafana/data';

import { LOG_LINE_BODY_FIELD_NAME } from '../LogDetailsBody';

import { LogListFontSize } from './LogList';
import { LogListModel } from './processing';

let ctx: CanvasRenderingContext2D | null = null;
let gridSize = 8;
let paddingBottom = gridSize * 0.75;
let lineHeight = 22;
let measurementMode: 'canvas' | 'dom' = 'canvas';
const iconWidth = 24;

export const LOG_LIST_MIN_WIDTH = 35 * gridSize;

// Controls the space between fields in the log line, timestamp, level, displayed fields, and log line body
export const FIELD_GAP_MULTIPLIER = 1.5;

export const getLineHeight = () => lineHeight;

export function init(theme: GrafanaTheme2, fontSize: LogListFontSize) {
  let fontSizePx = theme.typography.fontSize;

  if (fontSize === 'default') {
    lineHeight = theme.typography.fontSize * theme.typography.body.lineHeight;
  } else {
    fontSizePx =
      typeof theme.typography.bodySmall.fontSize === 'string' && theme.typography.bodySmall.fontSize.includes('rem')
        ? theme.typography.fontSize * parseFloat(theme.typography.bodySmall.fontSize)
        : parseInt(theme.typography.bodySmall.fontSize, 10);
    lineHeight = fontSizePx * theme.typography.bodySmall.lineHeight;
  }

  const font = `${fontSizePx}px ${theme.typography.fontFamilyMonospace}`;
  const letterSpacing = theme.typography.body.letterSpacing;

  initDOMmeasurement(font, letterSpacing);
  initCanvasMeasurement(font, letterSpacing);

  gridSize = theme.spacing.gridSize;
  paddingBottom = gridSize * 0.75;

  widthMap = new Map<number, number>();
  resetLogLineSizes();

  determineMeasurementMode();

  return true;
}

function determineMeasurementMode() {
  if (!ctx) {
    measurementMode = 'dom';
    return;
  }
  const canvasCharWidth = ctx.measureText('e').width;
  const domCharWidth = measureTextWidthWithDOM('e');
  const diff = domCharWidth - canvasCharWidth;
  if (diff >= 0.1) {
    console.warn('Virtualized log list: falling back to DOM for measurement');
    measurementMode = 'dom';
  }
}

function initCanvasMeasurement(font: string, letterSpacing: string | undefined) {
  const canvas = document.createElement('canvas');
  ctx = canvas.getContext('2d');
  if (!ctx) {
    return;
  }
  ctx.font = font;
  ctx.fontKerning = 'normal';
  ctx.fontStretch = 'normal';
  ctx.fontVariantCaps = 'normal';
  ctx.textRendering = 'optimizeLegibility';
  if (letterSpacing) {
    ctx.letterSpacing = letterSpacing;
  }
}

const span = document.createElement('span');
function initDOMmeasurement(font: string, letterSpacing: string | undefined) {
  span.style.font = font;
  span.style.visibility = 'hidden';
  span.style.position = 'absolute';
  span.style.wordBreak = 'break-all';
  if (letterSpacing) {
    span.style.letterSpacing = letterSpacing;
  }
}

let widthMap = new Map<number, number>();
export function measureTextWidth(text: string): number {
  if (!ctx) {
    throw new Error(`Measuring context canvas is not initialized. Call init() before.`);
  }
  const key = text.length;

  const storedWidth = widthMap.get(key);
  if (storedWidth) {
    return storedWidth;
  }

  const width = measurementMode === 'canvas' ? ctx.measureText(text).width : measureTextWidthWithDOM(text);
  widthMap.set(key, width);

  return width;
}

function measureTextWidthWithDOM(text: string) {
  span.textContent = text;

  document.body.appendChild(span);
  const width = span.getBoundingClientRect().width;
  document.body.removeChild(span);

  return width;
}

export function measureTextHeight(text: string, maxWidth: number, beforeWidth = 0) {
  let logLines = 0;
  const charWidth = measureTextWidth('e');
  let logLineCharsLength = Math.round(maxWidth / charWidth);
  const firstLineCharsLength = Math.floor((maxWidth - beforeWidth) / charWidth) - 2 * charWidth;
  const textLines = text.split('\n');

  // Skip unnecessary measurements
  if (textLines.length === 1 && text.length < firstLineCharsLength) {
    return {
      lines: 1,
      height: getLineHeight() + paddingBottom,
    };
  }

  const availableWidth = maxWidth - beforeWidth;
  for (const textLine of textLines) {
    for (let start = 0; start < textLine.length; ) {
      let testLogLine: string;
      let width = 0;
      let delta = 0;
      do {
        testLogLine = textLine.substring(start, start + logLineCharsLength - delta);
        let measuredLine = testLogLine;
        if (logLines > 0) {
          measuredLine.trimStart();
        }
        width = measureTextWidth(measuredLine);
        delta += 1;
      } while (width >= availableWidth);
      if (beforeWidth) {
        beforeWidth = 0;
      }
      logLines += 1;
      start += testLogLine.length;
    }
  }

  const height = logLines * getLineHeight() + paddingBottom;

  return {
    lines: logLines,
    height,
  };
}

export interface DisplayOptions {
  fontSize: LogListFontSize;
  hasLogsWithErrors?: boolean;
  hasSampledLogs?: boolean;
  showDuplicates: boolean;
  showTime: boolean;
  wrap: boolean;
}

export function getLogLineSize(
  logs: LogListModel[],
  container: HTMLDivElement | null,
  displayedFields: string[],
  { fontSize, hasLogsWithErrors, hasSampledLogs, showDuplicates, showTime, wrap }: DisplayOptions,
  index: number
) {
  if (!container) {
    return 0;
  }
  // !logs[index] means the line is not yet loaded by infinite scrolling
  if (!wrap || !logs[index]) {
    return getLineHeight() + paddingBottom;
  }
  // If a long line is collapsed, we show the line count + an extra line for the expand/collapse control
  logs[index].updateCollapsedState(displayedFields, container);
  if (logs[index].collapsed) {
    return (getTruncationLineCount() + 1) * getLineHeight();
  }

  const storedSize = retrieveLogLineSize(logs[index].uid, container, fontSize);
  if (storedSize) {
    return storedSize;
  }

  let textToMeasure = '';
  const gap = gridSize * FIELD_GAP_MULTIPLIER;
  const iconsGap = gridSize * 0.5;
  let optionsWidth = 0;
  if (showDuplicates) {
    optionsWidth += gridSize * 4.5 + iconsGap;
  }
  if (hasLogsWithErrors) {
    optionsWidth += gridSize * 2 + iconsGap;
  }
  if (hasSampledLogs) {
    optionsWidth += gridSize * 2 + iconsGap;
  }
  if (showTime) {
    optionsWidth += gap;
    textToMeasure += logs[index].timestamp;
  }
  // When logs are unwrapped, we want an empty column space to align with other log lines.
  if (logs[index].displayLevel || !wrap) {
    optionsWidth += gap;
    textToMeasure += logs[index].displayLevel ?? '';
  }
  for (const field of displayedFields) {
    textToMeasure = logs[index].getDisplayedFieldValue(field) + textToMeasure;
  }
  if (!displayedFields.length) {
    textToMeasure += ansicolor.strip(logs[index].body);
  }

  const { height } = measureTextHeight(textToMeasure, getLogContainerWidth(container), optionsWidth);
  // When the log is collapsed, add an extra line for the expand/collapse control
  return logs[index].collapsed === false ? height + getLineHeight() : height;
}

export interface LogFieldDimension {
  field: string;
  width: number;
}

export const calculateFieldDimensions = (logs: LogListModel[], displayedFields: string[] = []) => {
  if (!logs.length) {
    return [];
  }
  let timestampWidth = 0;
  let levelWidth = 0;
  const fieldWidths: Record<string, number> = {};
  for (let i = 0; i < logs.length; i++) {
    let width = measureTextWidth(logs[i].timestamp);
    if (width > timestampWidth) {
      timestampWidth = Math.round(width);
    }
    width = measureTextWidth(logs[i].displayLevel);
    if (width > levelWidth) {
      levelWidth = Math.round(width);
    }
    for (const field of displayedFields) {
      width = measureTextWidth(logs[i].getDisplayedFieldValue(field));
      fieldWidths[field] = !fieldWidths[field] || width > fieldWidths[field] ? Math.round(width) : fieldWidths[field];
    }
  }
  const dimensions: LogFieldDimension[] = [
    {
      field: 'timestamp',
      width: timestampWidth,
    },
    {
      field: 'level',
      width: levelWidth,
    },
  ];
  for (const field in fieldWidths) {
    // Skip the log line when it's a displayed field
    if (field === LOG_LINE_BODY_FIELD_NAME) {
      continue;
    }
    dimensions.push({
      field,
      width: fieldWidths[field],
    });
  }
  return dimensions;
};

// 2/3 of the viewport height
export const getTruncationLineCount = () => Math.round(window.innerHeight / getLineHeight() / 1.5);
export function getTruncationLength(container: HTMLDivElement | null) {
  const availableWidth = container ? getLogContainerWidth(container) : window.innerWidth;
  return (availableWidth / measureTextWidth('e')) * getTruncationLineCount();
}

export function hasUnderOrOverflow(
  element: HTMLDivElement,
  calculatedHeight?: number,
  collapsed?: boolean
): number | null {
  if (collapsed !== undefined && calculatedHeight) {
    calculatedHeight -= getLineHeight();
  }
  const height = calculatedHeight ?? element.clientHeight;
  if (element.scrollHeight > height) {
    return collapsed !== undefined ? element.scrollHeight + getLineHeight() : element.scrollHeight;
  }
  const child = element.children[1];
  if (child instanceof HTMLDivElement && child.clientHeight < height) {
    return collapsed !== undefined ? child.clientHeight + getLineHeight() : child.clientHeight;
  }
  return null;
}

const scrollBarWidth = getScrollbarWidth();

export function getLogContainerWidth(container: HTMLDivElement) {
  return container.clientWidth - scrollBarWidth - iconWidth;
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

let logLineSizesMap = new Map<string, number>();
export function resetLogLineSizes() {
  logLineSizesMap = new Map<string, number>();
}

export function storeLogLineSize(id: string, container: HTMLDivElement, height: number, fontSize: LogListFontSize) {
  const key = `${id}_${getLogContainerWidth(container)}_${fontSize}`;
  logLineSizesMap.set(key, height);
}

export function retrieveLogLineSize(id: string, container: HTMLDivElement, fontSize: LogListFontSize) {
  const key = `${id}_${getLogContainerWidth(container)}_${fontSize}`;
  return logLineSizesMap.get(key);
}

export interface ScrollToLogsEventPayload {
  scrollTo: 'top' | 'bottom';
}

export class ScrollToLogsEvent extends BusEventWithPayload<ScrollToLogsEventPayload> {
  static type = 'logs-panel-scroll-to';
}
