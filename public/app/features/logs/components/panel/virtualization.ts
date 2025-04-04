import { BusEventWithPayload, GrafanaTheme2 } from '@grafana/data';

import { LOG_LINE_BODY_FIELD_NAME } from '../LogDetailsBody';

import { getDisplayedFieldValue } from './LogLine';
import { LogListModel } from './processing';

let ctx: CanvasRenderingContext2D | null = null;
let gridSize = 8;
let paddingBottom = gridSize * 0.75;
let lineHeight = 22;
let measurementMode: 'canvas' | 'dom' = 'canvas';
const iconWidth = 24;

// Controls the space between fields in the log line, timestamp, level, displayed fields, and log line body
export const FIELD_GAP_MULTIPLIER = 1.5;
const LOG_LIST_NAVIGATION_WIDTH = 28;

export const getLineHeight = () => lineHeight;

export function init(theme: GrafanaTheme2) {
  const font = `${theme.typography.fontSize}px ${theme.typography.fontFamilyMonospace}`;
  const letterSpacing = theme.typography.body.letterSpacing;

  initDOMmeasurement(font, letterSpacing);
  initCanvasMeasurement(font, letterSpacing);

  gridSize = theme.spacing.gridSize;
  paddingBottom = gridSize * 0.75;
  lineHeight = theme.typography.fontSize * theme.typography.body.lineHeight;

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
      height: lineHeight + paddingBottom,
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
        width = measureTextWidth(testLogLine);
        delta += 1;
      } while (width >= availableWidth);
      if (beforeWidth) {
        beforeWidth = 0;
      }
      logLines += 1;
      start += testLogLine.length;
    }
  }

  const height = logLines * lineHeight + paddingBottom;

  return {
    lines: logLines,
    height,
  };
}

interface DisplayOptions {
  wrap: boolean;
  showControls: boolean;
  showTime: boolean;
}

export function getLogLineSize(
  logs: LogListModel[],
  container: HTMLDivElement | null,
  displayedFields: string[],
  { wrap, showControls, showTime }: DisplayOptions,
  index: number
) {
  if (!container) {
    return 0;
  }
  // !logs[index] means the line is not yet loaded by infinite scrolling
  if (!wrap || !logs[index]) {
    return lineHeight + paddingBottom;
  }
  const storedSize = retrieveLogLineSize(logs[index].uid, container);
  if (storedSize) {
    return storedSize;
  }

  let textToMeasure = '';
  const gap = gridSize * FIELD_GAP_MULTIPLIER;
  let optionsWidth = 0;
  if (showControls) {
    optionsWidth += LOG_LIST_NAVIGATION_WIDTH;
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
    textToMeasure = getDisplayedFieldValue(field, logs[index]) + textToMeasure;
  }
  if (!displayedFields.length) {
    textToMeasure += logs[index].body;
  }

  const { height } = measureTextHeight(textToMeasure, getLogContainerWidth(container), optionsWidth);
  return height;
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
      width = measureTextWidth(getDisplayedFieldValue(field, logs[i]));
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

export function hasUnderOrOverflow(element: HTMLDivElement, calculatedHeight?: number): number | null {
  const height = calculatedHeight ?? element.clientHeight;
  if (element.scrollHeight > height) {
    return element.scrollHeight;
  }
  const child = element.children[1];
  if (child instanceof HTMLDivElement && child.clientHeight < height) {
    return child.clientHeight;
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
