import { render } from '@testing-library/react';

import { LogsSortOrder } from '@grafana/data';

import { createLogLine } from '../mocks/logRow';

import { HighlightedLogRenderer } from './HighlightedLogRenderer';

describe('HighlightedLogRenderer', () => {
  test.each([
    [false, false],
    [true, false],
    [false, true],
    [true, true],
  ])('Serializes JSON to the same string', (wrapLogMessage: boolean, prettifyJSON: boolean) => {
    const log = createLogLine(
      {
        entry: `{
  "_entry": "log text [149843146]",
  "counter": "11203",
  "float": "12.53",
  "wave": 0.8090169943751789,
  "label": "val3",
  "level": "info",
  "array": ["1", 2, { "test": "test" }],
}`,
      },
      {
        escape: false,
        order: LogsSortOrder.Descending,
        timeZone: 'browser',
        wrapLogMessage,
        prettifyJSON,
      }
    );

    const { container } = render(<HighlightedLogRenderer log={log} />);

    expect(container.innerHTML).toEqual(log.highlightedBody);
  });
});
