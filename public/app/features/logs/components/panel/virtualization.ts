import ansicolor from 'ansicolor';

import { BusEventWithPayload, GrafanaTheme2 } from '@grafana/data';

import { LogLineTimestampResolution } from './LogLine';
import { LOG_LINE_DETAILS_HEIGHT, LogLineDetailsMode } from './LogLineDetails';
import { LogListFontSize } from './LogList';
import { LogListModel } from './processing';

export const LOG_LIST_MIN_WIDTH = 35 * 8;
// Controls the space between fields in the log line, timestamp, level, displayed fields, and log line body
export const FIELD_GAP_MULTIPLIER = 1.5;

export const DEFAULT_LINE_HEIGHT = 22;

export const LOG_LIST_CONTROLS_WIDTH = 32;

export class LogLineVirtualization {
  private ctx: CanvasRenderingContext2D | null = null;
  private gridSize;
  private paddingBottom;
  private lineHeight;
  private measurementMode: 'canvas' | 'dom' = 'canvas';
  private textWidthMap: Map<number, number>;
  private logLineSizesMap: Map<string, number>;
  private spanElement = document.createElement('span');
  readonly fontSize: LogListFontSize;

  constructor(theme: GrafanaTheme2, fontSize: LogListFontSize) {
    this.fontSize = fontSize;

    let fontSizePx;
    if (fontSize === 'default') {
      fontSizePx = theme.typography.fontSize;
      this.lineHeight = theme.typography.fontSize * theme.typography.body.lineHeight;
    } else {
      fontSizePx =
        typeof theme.typography.bodySmall.fontSize === 'string' && theme.typography.bodySmall.fontSize.includes('rem')
          ? theme.typography.fontSize * parseFloat(theme.typography.bodySmall.fontSize)
          : parseInt(theme.typography.bodySmall.fontSize, 10);
      this.lineHeight = fontSizePx * theme.typography.bodySmall.lineHeight;
    }

    this.gridSize = theme.spacing.gridSize;
    this.paddingBottom = this.gridSize * 0.75;
    this.logLineSizesMap = new Map<string, number>();
    this.textWidthMap = new Map<number, number>();

    const font = `${fontSizePx}px ${theme.typography.fontFamilyMonospace}`;
    const letterSpacing = theme.typography.body.letterSpacing;

    this.initDOMmeasurement(font, letterSpacing);
    this.initCanvasMeasurement(font, letterSpacing);
    this.determineMeasurementMode();
  }

  getLineHeight = () => this.lineHeight;
  getGridSize = () => this.gridSize;
  getPaddingBottom = () => this.paddingBottom;

  getTruncationLineCount = () => Math.round(window.innerHeight / this.getLineHeight() / 1.5);

  getTruncationLength = (container: HTMLDivElement | null) => {
    const availableWidth = container ? getLogContainerWidth(container) : window.innerWidth;
    return (availableWidth / this.measureTextWidth('e')) * this.getTruncationLineCount();
  };

  determineMeasurementMode = () => {
    if (!this.ctx) {
      this.measurementMode = 'dom';
      return;
    }
    const canvasCharWidth = this.ctx.measureText('e').width;
    const domCharWidth = this.measureTextWidthWithDOM('e');
    const diff = domCharWidth - canvasCharWidth;
    if (diff >= 0.1) {
      console.warn('Virtualized log list: falling back to DOM for measurement');
      this.measurementMode = 'dom';
    }
  };

  initCanvasMeasurement = (font: string, letterSpacing: string | undefined) => {
    const canvas = document.createElement('canvas');
    this.ctx = canvas.getContext('2d');
    if (!this.ctx) {
      return;
    }
    this.ctx.font = font;
    this.ctx.fontKerning = 'normal';
    this.ctx.fontStretch = 'normal';
    this.ctx.fontVariantCaps = 'normal';
    this.ctx.textRendering = 'optimizeLegibility';
    if (letterSpacing) {
      this.ctx.letterSpacing = letterSpacing;
    }
  };

  initDOMmeasurement = (font: string, letterSpacing: string | undefined) => {
    this.spanElement.style.font = font;
    this.spanElement.style.visibility = 'hidden';
    this.spanElement.style.position = 'absolute';
    this.spanElement.style.wordBreak = 'break-all';
    if (letterSpacing) {
      this.spanElement.style.letterSpacing = letterSpacing;
    }
  };

  measureTextWidth = (text: string): number => {
    if (!this.ctx) {
      throw new Error(`Measuring context canvas is not initialized. Call init() before.`);
    }
    const key = text.length;

    const storedWidth = this.textWidthMap.get(key);
    if (storedWidth) {
      return storedWidth;
    }

    const width =
      this.measurementMode === 'canvas' ? this.ctx.measureText(text).width : this.measureTextWidthWithDOM(text);
    this.textWidthMap.set(key, width);

    return width;
  };

  measureTextWidthWithDOM = (text: string) => {
    this.spanElement.textContent = text;

    document.body.appendChild(this.spanElement);
    const width = this.spanElement.getBoundingClientRect().width;
    document.body.removeChild(this.spanElement);

    return width;
  };

  measureTextHeight = (text: string, maxWidth: number, beforeWidth = 0) => {
    let logLines = 0;
    const charWidth = this.measureTextWidth('e');
    let logLineCharsLength = Math.round(maxWidth / charWidth);
    const firstLineCharsLength = Math.floor((maxWidth - beforeWidth) / charWidth) - 2 * charWidth;
    const textLines = text.split('\n');

    // Skip unnecessary measurements
    if (textLines.length === 1 && text.length < firstLineCharsLength) {
      return {
        lines: 1,
        height: this.getLineHeight() + this.paddingBottom,
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
          width = this.measureTextWidth(measuredLine);
          delta += 1;
        } while (width >= availableWidth);
        if (beforeWidth) {
          beforeWidth = 0;
        }
        logLines += 1;
        start += testLogLine.length;
      }
    }

    const height = logLines * this.getLineHeight() + this.paddingBottom;

    return {
      lines: logLines,
      height,
    };
  };

  calculateFieldDimensions = (
    logs: LogListModel[],
    displayedFields: string[] = [],
    timestampResolution: LogLineTimestampResolution
  ) => {
    if (!logs.length) {
      return [];
    }
    let timestampWidth = 0;
    let levelWidth = 0;
    const fieldWidths: Record<string, number> = {};
    for (let i = 0; i < logs.length; i++) {
      let width = this.measureTextWidth(timestampResolution === 'ms' ? logs[i].timestamp : logs[i].timestampNs);
      if (width > timestampWidth) {
        timestampWidth = Math.round(width);
      }
      width = this.measureTextWidth(logs[i].displayLevel);
      if (width > levelWidth) {
        levelWidth = Math.round(width);
      }
      for (const field of displayedFields) {
        width = this.measureTextWidth(logs[i].getDisplayedFieldValue(field, true));
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
      dimensions.push({
        field,
        width: fieldWidths[field],
      });
    }
    return dimensions;
  };

  resetLogLineSizes = () => {
    this.logLineSizesMap = new Map<string, number>();
  };

  storeLogLineSize = (id: string, container: HTMLDivElement, height: number) => {
    const key = `${id}_${getLogContainerWidth(container)}_${this.fontSize}`;
    this.logLineSizesMap.set(key, height);
  };

  retrieveLogLineSize = (id: string, container: HTMLDivElement) => {
    const key = `${id}_${getLogContainerWidth(container)}_${this.fontSize}`;
    return this.logLineSizesMap.get(key);
  };
}

export interface DisplayOptions {
  detailsMode: LogLineDetailsMode;
  hasLogsWithErrors?: boolean;
  hasSampledLogs?: boolean;
  showDetails: LogListModel[];
  showDuplicates: boolean;
  showTime: boolean;
  wrap: boolean;
}

export function getLogLineSize(
  virtualization: LogLineVirtualization,
  logs: LogListModel[],
  container: HTMLDivElement | null,
  displayedFields: string[],
  { detailsMode, hasLogsWithErrors, hasSampledLogs, showDuplicates, showDetails, showTime, wrap }: DisplayOptions,
  index: number
) {
  if (!container) {
    return 0;
  }
  const gap = virtualization.getGridSize() * FIELD_GAP_MULTIPLIER;
  const detailsHeight =
    detailsMode === 'inline' && logs[index] && showDetails.findIndex((log) => log.uid === logs[index].uid) >= 0
      ? window.innerHeight * (LOG_LINE_DETAILS_HEIGHT / 100) + gap / 2
      : 0;
  // !logs[index] means the line is not yet loaded by infinite scrolling
  if (!wrap || !logs[index]) {
    return virtualization.getLineHeight() + virtualization.getPaddingBottom() + detailsHeight;
  }
  // If a long line is collapsed, we show the line count + an extra line for the expand/collapse control
  logs[index].updateCollapsedState(displayedFields, container);
  if (logs[index].collapsed) {
    return (virtualization.getTruncationLineCount() + 1) * virtualization.getLineHeight() + detailsHeight;
  }

  const storedSize = virtualization.retrieveLogLineSize(logs[index].uid, container);
  if (storedSize) {
    return storedSize;
  }

  let textToMeasure = '';
  const iconsGap = virtualization.getGridSize() * 0.5;
  let optionsWidth = 0;
  if (showDuplicates) {
    optionsWidth += virtualization.getGridSize() * 4.5 + iconsGap;
  }
  if (hasLogsWithErrors) {
    optionsWidth += virtualization.getGridSize() * 2 + iconsGap;
  }
  if (hasSampledLogs) {
    optionsWidth += virtualization.getGridSize() * 2 + iconsGap;
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
    textToMeasure = logs[index].getDisplayedFieldValue(field, true) + textToMeasure;
  }
  if (!displayedFields.length) {
    textToMeasure += ansicolor.strip(logs[index].body);
  }

  const { height } = virtualization.measureTextHeight(textToMeasure, getLogContainerWidth(container), optionsWidth);
  // When the log is collapsed, add an extra line for the expand/collapse control
  return logs[index].collapsed === false
    ? height + virtualization.getLineHeight() + detailsHeight
    : height + detailsHeight;
}

export interface LogFieldDimension {
  field: string;
  width: number;
}

export function hasUnderOrOverflow(
  virtualization: LogLineVirtualization,
  element: HTMLDivElement,
  calculatedHeight?: number,
  collapsed?: boolean
): number | null {
  if (collapsed !== undefined && calculatedHeight) {
    calculatedHeight -= virtualization.getLineHeight();
  }
  const inlineDetails = element.parentElement
    ? Array.from(element.parentElement.children).filter((element) =>
        element.classList.contains('log-line-inline-details')
      )
    : undefined;
  const detailsHeight = inlineDetails?.length ? inlineDetails[0].clientHeight : 0;

  // Line overflows container
  let measuredHeight = element.scrollHeight + detailsHeight;
  const height = calculatedHeight ?? element.clientHeight;
  if (measuredHeight > height) {
    return collapsed !== undefined ? measuredHeight + virtualization.getLineHeight() : measuredHeight;
  }

  // Line is smaller than container
  const child = element.children[1];
  measuredHeight = child.clientHeight + detailsHeight;
  if (child instanceof HTMLDivElement && measuredHeight < height) {
    return collapsed !== undefined ? measuredHeight + virtualization.getLineHeight() : measuredHeight;
  }

  // No overflow or undermeasurement
  return null;
}

const logLineMenuIconWidth = 24;
const scrollBarWidth = getScrollbarWidth();

export function getLogContainerWidth(container: HTMLDivElement) {
  return container.clientWidth - scrollBarWidth - logLineMenuIconWidth;
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

export interface ScrollToLogsEventPayload {
  scrollTo: 'top' | 'bottom' | string;
}

export class ScrollToLogsEvent extends BusEventWithPayload<ScrollToLogsEventPayload> {
  static type = 'logs-panel-scroll-to';
}
