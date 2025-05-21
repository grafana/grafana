import { createTheme } from '@grafana/data';

import { LOG_LINE_BODY_FIELD_NAME } from '../LogDetailsBody';
import { createLogLine } from '../__mocks__/logRow';

import { LogListModel } from './processing';
import { getLineHeight, getLogLineSize, init, measureTextWidth, TRUNCATION_LINE_COUNT } from './virtualization';

const PADDING_BOTTOM = 6;
const LINE_HEIGHT = getLineHeight();
const SINGLE_LINE_HEIGHT = LINE_HEIGHT + PADDING_BOTTOM;
const TWO_LINES_HEIGHT = 2 * LINE_HEIGHT + PADDING_BOTTOM;
const THREE_LINES_HEIGHT = 3 * LINE_HEIGHT + PADDING_BOTTOM;
let LETTER_WIDTH: number;
let CONTAINER_SIZE = 200;
let TWO_LINES_OF_CHARACTERS: number;

describe('Virtualization', () => {
  let log: LogListModel, container: HTMLDivElement;
  beforeEach(() => {
    log = createLogLine({ labels: { place: 'luna' }, entry: `log message 1` });
    container = document.createElement('div');
    jest.spyOn(container, 'clientWidth', 'get').mockReturnValue(CONTAINER_SIZE);
    init(createTheme());
    LETTER_WIDTH = measureTextWidth('e');
    TWO_LINES_OF_CHARACTERS = (CONTAINER_SIZE / LETTER_WIDTH) * 1.5;
  });

  describe('getLogLineSize', () => {
    test('Returns the a single line if the display mode is unwrapped', () => {
      const size = getLogLineSize([log], container, [], { wrap: false, showTime: true, showDuplicates: false }, 0);
      expect(size).toBe(SINGLE_LINE_HEIGHT);
    });

    test('Returns the a single line if the line is not loaded yet', () => {
      const logs = [log];
      const size = getLogLineSize(
        logs,
        container,
        [],
        { wrap: true, showTime: true, showDuplicates: false },
        logs.length + 1
      );
      expect(size).toBe(SINGLE_LINE_HEIGHT);
    });

    test('Returns the size of a truncated long line', () => {
      // Very small container
      log.collapsed = true;
      jest.spyOn(container, 'clientWidth', 'get').mockReturnValue(10);
      const size = getLogLineSize([log], container, [], { wrap: true, showTime: true, showDuplicates: false }, 0);
      expect(size).toBe((TRUNCATION_LINE_COUNT + 1) * LINE_HEIGHT);
    });

    test.each([true, false])('Measures a log line with controls %s and displayed time %s', (showTime: boolean) => {
      const size = getLogLineSize([log], container, [], { wrap: true, showTime, showDuplicates: false }, 0);
      expect(size).toBe(SINGLE_LINE_HEIGHT);
    });

    test('Measures a multi-line log line with no displayed time', () => {
      log = createLogLine({
        labels: { place: 'luna' },
        entry: new Array(TWO_LINES_OF_CHARACTERS).fill('e').join(''),
        logLevel: undefined,
      });

      const size = getLogLineSize([log], container, [], { wrap: true, showTime: false, showDuplicates: false }, 0);
      expect(size).toBe(TWO_LINES_HEIGHT);
    });

    test('Measures a multi-line log line with level, controls, and displayed time', () => {
      log = createLogLine({ labels: { place: 'luna' }, entry: new Array(TWO_LINES_OF_CHARACTERS).fill('e').join('') });

      const size = getLogLineSize([log], container, [], { wrap: true, showTime: true, showDuplicates: false }, 0);
      // Two lines for the log and one extra for level and time
      expect(size).toBe(THREE_LINES_HEIGHT);
    });

    test('Measures a multi-line log line with displayed fields', () => {
      log = createLogLine({
        labels: { place: 'very very long value for the displayed field that causes a new line' },
        entry: new Array(TWO_LINES_OF_CHARACTERS).fill('e').join(''),
        logLevel: undefined,
      });

      const size = getLogLineSize(
        [log],
        container,
        ['place', LOG_LINE_BODY_FIELD_NAME],
        { wrap: true, showTime: false, showDuplicates: false },
        0
      );
      // Two lines for the log and one extra for the displayed fields
      expect(size).toBe(THREE_LINES_HEIGHT);
    });

    test('Measures displayed fields in a log line with level, controls, and displayed time', () => {
      log = createLogLine({ labels: { place: 'luna' }, entry: new Array(TWO_LINES_OF_CHARACTERS).fill('e').join('') });

      const size = getLogLineSize(
        [log],
        container,
        ['place'],
        { wrap: true, showTime: true, showDuplicates: false },
        0
      );
      // Only renders a short displayed field, so a single line
      expect(size).toBe(SINGLE_LINE_HEIGHT);
    });

    test('Measures a multi-line log line with duplicates', () => {
      log = createLogLine({ labels: { place: 'luna' }, entry: new Array(TWO_LINES_OF_CHARACTERS).fill('e').join('') });
      log.duplicates = 1;

      const size = getLogLineSize([log], container, [], { wrap: true, showTime: false, showDuplicates: true }, 0);
      // Two lines for the log and one extra for duplicates
      expect(size).toBe(THREE_LINES_HEIGHT);
    });

    test('Measures a multi-line log line with errors', () => {
      log = createLogLine({ labels: { place: 'luna' }, entry: new Array(TWO_LINES_OF_CHARACTERS).fill('e').join('') });
      log.hasError = true;

      const size = getLogLineSize([log], container, [], { wrap: true, showTime: false, showDuplicates: false }, 0);
      // Two lines for the log and one extra for the error icon
      expect(size).toBe(THREE_LINES_HEIGHT);
    });

    test('Measures a multi-line sampled log line', () => {
      log = createLogLine({ labels: { place: 'luna' }, entry: new Array(TWO_LINES_OF_CHARACTERS).fill('e').join('') });
      log.isSampled = true;

      const size = getLogLineSize([log], container, [], { wrap: true, showTime: false, showDuplicates: false }, 0);
      // Two lines for the log and one extra for the sampled icon
      expect(size).toBe(THREE_LINES_HEIGHT);
    });

    test('Adds an extra line for the expand/collapse controls if present', () => {
      jest.spyOn(log, 'updateCollapsedState').mockImplementation(() => undefined);
      log.collapsed = false;
      const size = getLogLineSize([log], container, [], { wrap: true, showTime: false, showDuplicates: false }, 0);
      expect(size).toBe(TWO_LINES_HEIGHT);
    });
  });
});
