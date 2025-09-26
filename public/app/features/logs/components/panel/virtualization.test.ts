import { createTheme, LogsSortOrder } from '@grafana/data';

import { LOG_LINE_BODY_FIELD_NAME } from '../LogDetailsBody';
import { createLogLine } from '../mocks/logRow';

import { LOG_LINE_DETAILS_HEIGHT } from './LogLineDetails';
import { LogListModel, PreProcessOptions } from './processing';
import { LogLineVirtualization, getLogLineSize, DisplayOptions, FIELD_GAP_MULTIPLIER } from './virtualization';

describe('Virtualization', () => {
  let log: LogListModel, container: HTMLDivElement;

  let virtualization = new LogLineVirtualization(createTheme(), 'default');

  const GAP = virtualization.getGridSize() * FIELD_GAP_MULTIPLIER;
  const DETAILS_HEIGHT = window.innerHeight * (LOG_LINE_DETAILS_HEIGHT / 100) + GAP / 2;
  const PADDING_BOTTOM = 6;
  const LINE_HEIGHT = virtualization.getLineHeight();
  const SINGLE_LINE_HEIGHT = LINE_HEIGHT + PADDING_BOTTOM;
  const TWO_LINES_HEIGHT = 2 * LINE_HEIGHT + PADDING_BOTTOM;
  const THREE_LINES_HEIGHT = 3 * LINE_HEIGHT + PADDING_BOTTOM;
  let LETTER_WIDTH: number;
  let CONTAINER_SIZE = 200;
  let TWO_LINES_OF_CHARACTERS: number;

  const defaultOptions: DisplayOptions = {
    detailsMode: 'sidebar',
    wrap: false,
    showTime: false,
    showDetails: [],
    showDuplicates: false,
    hasLogsWithErrors: false,
    hasSampledLogs: false,
  };

  const preProcessOptions: PreProcessOptions = {
    escape: false,
    order: LogsSortOrder.Descending,
    timeZone: 'browser',
    virtualization,
    wrapLogMessage: true,
  };

  beforeEach(() => {
    log = createLogLine({ labels: { place: 'luna' }, entry: `log message 1` }, preProcessOptions);
    container = document.createElement('div');
    jest.spyOn(container, 'clientWidth', 'get').mockReturnValue(CONTAINER_SIZE);
    LETTER_WIDTH = virtualization.measureTextWidth('e');
    TWO_LINES_OF_CHARACTERS = (CONTAINER_SIZE / LETTER_WIDTH) * 1.5;
  });

  describe('getLogLineSize', () => {
    test('Returns the a single line if the display mode is unwrapped', () => {
      const size = getLogLineSize(virtualization, [log], container, [], { ...defaultOptions, showTime: true }, 0);
      expect(size).toBe(SINGLE_LINE_HEIGHT);
    });

    test('Returns the a single line plus inline details if the display mode is unwrapped', () => {
      const size = getLogLineSize(
        virtualization,
        [log],
        container,
        [],
        { ...defaultOptions, showTime: true, showDetails: [log], detailsMode: 'inline' },
        0
      );
      expect(size).toBe(SINGLE_LINE_HEIGHT + DETAILS_HEIGHT);
    });

    test('Should not throw when an undefined index is passed', () => {
      const size = getLogLineSize(
        virtualization,
        [log],
        container,
        [],
        { ...defaultOptions, showTime: true, showDetails: [log], detailsMode: 'inline' },
        1 // Index out of bounds
      );
      expect(size).toBe(SINGLE_LINE_HEIGHT);
    });

    test('Returns the a single line if the line is not loaded yet', () => {
      const logs = [log];
      const size = getLogLineSize(
        virtualization,
        logs,
        container,
        [],
        { ...defaultOptions, wrap: true, showTime: true },
        logs.length + 1
      );
      expect(size).toBe(SINGLE_LINE_HEIGHT);
    });

    test('Returns the size of a truncated long line', () => {
      // Very small container
      log.collapsed = true;
      jest.spyOn(container, 'clientWidth', 'get').mockReturnValue(10);
      const size = getLogLineSize(
        virtualization,
        [log],
        container,
        [],
        { ...defaultOptions, wrap: true, showTime: true },
        0
      );
      expect(size).toBe((virtualization.getTruncationLineCount() + 1) * LINE_HEIGHT);
    });

    test('Returns the size of a truncated long line with inline details', () => {
      // Very small container
      log.collapsed = true;
      jest.spyOn(container, 'clientWidth', 'get').mockReturnValue(10);
      const size = getLogLineSize(
        virtualization,
        [log],
        container,
        [],
        { ...defaultOptions, wrap: true, showTime: true, showDetails: [log], detailsMode: 'inline' },
        0
      );
      expect(size).toBe((virtualization.getTruncationLineCount() + 1) * LINE_HEIGHT + DETAILS_HEIGHT);
    });

    test.each([true, false])('Measures a log line with controls %s and displayed time %s', (showTime: boolean) => {
      const size = getLogLineSize(virtualization, [log], container, [], { ...defaultOptions, wrap: true, showTime }, 0);
      expect(size).toBe(SINGLE_LINE_HEIGHT);
    });

    test('Measures a multi-line log line with no displayed time', () => {
      log = createLogLine(
        {
          labels: { place: 'luna' },
          entry: new Array(TWO_LINES_OF_CHARACTERS).fill('e').join(''),
          logLevel: undefined,
        },
        preProcessOptions
      );

      const size = getLogLineSize(virtualization, [log], container, [], { ...defaultOptions, wrap: true }, 0);
      expect(size).toBe(TWO_LINES_HEIGHT);
    });

    test('Measures a multi-line log line with level, controls, and displayed time', () => {
      log = createLogLine(
        { labels: { place: 'luna' }, entry: new Array(TWO_LINES_OF_CHARACTERS).fill('e').join('') },
        preProcessOptions
      );

      const size = getLogLineSize(
        virtualization,
        [log],
        container,
        [],
        { ...defaultOptions, wrap: true, showTime: true },
        0
      );
      // Two lines for the log and one extra for level and time
      expect(size).toBe(THREE_LINES_HEIGHT);
    });

    test('Measures a multi-line log line with level, controls, displayed time, and inline details', () => {
      log = createLogLine(
        { labels: { place: 'luna' }, entry: new Array(TWO_LINES_OF_CHARACTERS).fill('e').join('') },
        preProcessOptions
      );

      const size = getLogLineSize(
        virtualization,
        [log],
        container,
        [],
        { ...defaultOptions, wrap: true, showTime: true, showDetails: [log], detailsMode: 'inline' },
        0
      );
      // Two lines for the log and one extra for level and time
      expect(size).toBe(THREE_LINES_HEIGHT + DETAILS_HEIGHT);
    });

    test('Measures a multi-line log line with displayed fields', () => {
      log = createLogLine(
        {
          labels: { place: 'very very long value for the displayed field that causes a new line' },
          entry: new Array(TWO_LINES_OF_CHARACTERS).fill('e').join(''),
          logLevel: undefined,
        },
        preProcessOptions
      );

      const size = getLogLineSize(
        virtualization,
        [log],
        container,
        ['place', LOG_LINE_BODY_FIELD_NAME],
        { ...defaultOptions, wrap: true },
        0
      );
      // Two lines for the log and one extra for the displayed fields
      expect(size).toBe(THREE_LINES_HEIGHT);
    });

    test('Measures displayed fields in a log line with level, controls, and displayed time', () => {
      log = createLogLine(
        { labels: { place: 'luna' }, entry: new Array(TWO_LINES_OF_CHARACTERS).fill('e').join('') },
        preProcessOptions
      );

      const size = getLogLineSize(
        virtualization,
        [log],
        container,
        ['place'],
        { ...defaultOptions, wrap: true, showTime: true },
        0
      );
      // Only renders a short displayed field, so a single line
      expect(size).toBe(SINGLE_LINE_HEIGHT);
    });

    test('Measures a multi-line log line with duplicates', () => {
      log = createLogLine(
        { labels: { place: 'luna' }, entry: new Array(TWO_LINES_OF_CHARACTERS).fill('e').join('') },
        preProcessOptions
      );
      log.duplicates = 1;

      const size = getLogLineSize(
        virtualization,
        [log],
        container,
        [],
        { ...defaultOptions, wrap: true, showDuplicates: true },
        0
      );
      // Two lines for the log and one extra for duplicates
      expect(size).toBe(THREE_LINES_HEIGHT);
    });

    test('Measures a multi-line log line with errors', () => {
      log = createLogLine(
        { labels: { place: 'luna' }, entry: new Array(TWO_LINES_OF_CHARACTERS).fill('e').join('') },
        preProcessOptions
      );

      const size = getLogLineSize(
        virtualization,
        [log],
        container,
        [],
        { ...defaultOptions, wrap: true, hasLogsWithErrors: true },
        0
      );
      // Two lines for the log and one extra for the error icon
      expect(size).toBe(THREE_LINES_HEIGHT);
    });

    test('Measures a multi-line sampled log line', () => {
      log = createLogLine(
        { labels: { place: 'luna' }, entry: new Array(TWO_LINES_OF_CHARACTERS).fill('e').join('') },
        preProcessOptions
      );

      const size = getLogLineSize(
        virtualization,
        [log],
        container,
        [],
        { ...defaultOptions, wrap: true, hasSampledLogs: true },
        0
      );
      // Two lines for the log and one extra for the sampled icon
      expect(size).toBe(THREE_LINES_HEIGHT);
    });

    test('Adds an extra line for the expand/collapse controls if present', () => {
      jest.spyOn(log, 'updateCollapsedState').mockImplementation(() => undefined);
      log.collapsed = false;
      const size = getLogLineSize(virtualization, [log], container, [], { ...defaultOptions, wrap: true }, 0);
      expect(size).toBe(TWO_LINES_HEIGHT);
    });
  });

  describe('calculateFieldDimensions', () => {
    test('Measures displayed fields including the log line body', () => {
      expect(virtualization.calculateFieldDimensions([log], ['place', LOG_LINE_BODY_FIELD_NAME], 'ms')).toEqual([
        {
          field: 'timestamp',
          width: 23,
        },
        {
          field: 'level',
          width: 4,
        },
        {
          field: 'place',
          width: 4,
        },
        {
          field: '___LOG_LINE_BODY___',
          width: 13,
        },
      ]);
    });

    test('Measures nanosecond timestamps', () => {
      expect(virtualization.calculateFieldDimensions([log], [], 'ns')).toEqual([
        {
          field: 'timestamp',
          width: 29,
        },
        {
          field: 'level',
          width: 4,
        },
      ]);
    });
  });

  describe('With small font size', () => {
    const virtualization = new LogLineVirtualization(createTheme(), 'small');

    beforeEach(() => {
      LETTER_WIDTH = virtualization.measureTextWidth('e');
      TWO_LINES_OF_CHARACTERS = (CONTAINER_SIZE / LETTER_WIDTH) * 1.5;
    });

    test('Measures a multi-line log line with displayed fields', () => {
      const SMALL_LINE_HEIGHT = virtualization.getLineHeight();
      const SMALL_THREE_LINES_HEIGHT = 3 * SMALL_LINE_HEIGHT + PADDING_BOTTOM;

      log = createLogLine(
        {
          labels: { place: 'very very long value for the displayed field that causes a new line' },
          entry: new Array(TWO_LINES_OF_CHARACTERS).fill('e').join(''),
          logLevel: undefined,
        },
        preProcessOptions
      );

      const size = getLogLineSize(
        virtualization,
        [log],
        container,
        ['place', LOG_LINE_BODY_FIELD_NAME],
        { ...defaultOptions, wrap: true },
        0
      );
      // Two lines for the log and one extra for the displayed fields
      expect(size).toBe(SMALL_THREE_LINES_HEIGHT);
    });
  });
});
