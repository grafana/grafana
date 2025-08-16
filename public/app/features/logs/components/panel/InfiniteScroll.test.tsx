import { act, render, screen } from '@testing-library/react';
import { VariableSizeList } from 'react-window';

import { createTheme, dateTimeForTimeZone, rangeUtil } from '@grafana/data';
import { config } from '@grafana/runtime';
import { LogsSortOrder } from '@grafana/schema';

import { ScrollDirection, SCROLLING_THRESHOLD } from '../InfiniteScroll';
import { createLogLine } from '../mocks/logRow';

import { InfiniteScroll, InfiniteScrollMode, Props } from './InfiniteScroll';
import { LogListModel } from './processing';
import { LogLineVirtualization } from './virtualization';

const defaultTz = 'browser';

const absoluteRange = {
  from: 1702578600000,
  to: 1702578900000,
};
const defaultRange = rangeUtil.convertRawToRange({
  from: dateTimeForTimeZone(defaultTz, absoluteRange.from),
  to: dateTimeForTimeZone(defaultTz, absoluteRange.to),
});

const theme = createTheme();
const virtualization = new LogLineVirtualization(theme, 'default');
const defaultProps: Omit<Props, 'children' | 'scrollElement'> = {
  loadMore: jest.fn(),
  timeRange: defaultRange,
  logs: [],
  sortOrder: LogsSortOrder.Descending,
  timeZone: 'browser',
  displayedFields: [],
  handleOverflow: jest.fn(),
  infiniteScrollMode: 'interval',
  onClick: jest.fn(),
  setInitialScrollPosition: jest.fn(),
  showTime: false,
  virtualization,
  wrapLogMessage: false,
};

function setup(
  loadMoreMock: () => void,
  startPosition: number,
  logs: LogListModel[],
  order: LogsSortOrder,
  infiniteScrollMode: InfiniteScrollMode = 'interval',
  { element, events } = getMockElement(startPosition)
) {
  function scrollTo(position: number, timeStamp?: number) {
    element.scrollTop = position;

    act(() => {
      const event = new Event('scroll');
      if (timeStamp) {
        jest.spyOn(event, 'timeStamp', 'get').mockReturnValue(timeStamp);
      }
      events['scroll'](event);
    });

    // When scrolling top, we wait for the user to reach the top, and then for a new scrolling event
    // in the same direction before triggering a new query.
    if (position === 0) {
      wheel(-1);
    }
  }
  function wheel(deltaY: number, timeStamp?: number) {
    element.scrollTop += deltaY;
    if (element.scrollTop < 0) {
      element.scrollTop = 0;
    }

    act(() => {
      const event = new WheelEvent('wheel', { deltaY });
      if (timeStamp) {
        jest.spyOn(event, 'timeStamp', 'get').mockReturnValue(timeStamp);
      }
      events['wheel'](event);
    });
  }

  render(
    <InfiniteScroll
      {...defaultProps}
      sortOrder={order}
      logs={logs}
      scrollElement={element as unknown as HTMLDivElement}
      loadMore={loadMoreMock}
      infiniteScrollMode={infiniteScrollMode}
    >
      {({ getItemKey, itemCount, onItemsRendered, Renderer }) => (
        <VariableSizeList
          height={100}
          itemCount={itemCount}
          itemSize={() => virtualization.getLineHeight()}
          itemKey={getItemKey}
          layout="vertical"
          onItemsRendered={onItemsRendered}
          style={{ overflow: 'scroll' }}
          width="100%"
        >
          {Renderer}
        </VariableSizeList>
      )}
    </InfiniteScroll>
  );

  return { element, events, scrollTo, wheel };
}

const originalState = config.featureToggles.logsInfiniteScrolling;
beforeAll(() => {
  config.featureToggles.logsInfiniteScrolling = true;
});
afterAll(() => {
  config.featureToggles.logsInfiniteScrolling = originalState;
});

describe('InfiniteScroll', () => {
  describe.each([LogsSortOrder.Descending, LogsSortOrder.Ascending])(
    'When the sort order is descending',
    (order: LogsSortOrder) => {
      let logs: LogListModel[];
      beforeEach(() => {
        logs = createLogs(absoluteRange.from + 2 * SCROLLING_THRESHOLD, absoluteRange.to - 2 * SCROLLING_THRESHOLD);
      });

      test.each([
        ['top', 10, 0],
        ['bottom', 50, 60],
      ])(
        'Requests more logs when scrolling %s',
        async (direction: string, startPosition: number, endPosition: number) => {
          const loadMoreMock = jest.fn();
          const { scrollTo } = setup(loadMoreMock, startPosition, logs, order);

          expect(await screen.findByText('log line 1')).toBeInTheDocument();

          scrollTo(endPosition - 1, 1);
          scrollTo(endPosition, 600);

          expect(loadMoreMock).toHaveBeenCalled();
          expect(await screen.findByTestId('Spinner')).toBeInTheDocument();
        }
      );

      test.each([
        ['up', -5, 0],
        ['down', 5, 60],
      ])(
        'Requests more logs when moving the mousewheel %s',
        async (_: string, deltaY: number, startPosition: number) => {
          const loadMoreMock = jest.fn();
          const { wheel } = setup(loadMoreMock, startPosition, logs, order);

          expect(await screen.findByText('log line 1')).toBeInTheDocument();

          wheel(deltaY, 1);
          wheel(deltaY, 600);

          expect(loadMoreMock).toHaveBeenCalled();
          expect(await screen.findByTestId('Spinner')).toBeInTheDocument();
        }
      );

      test('Does not request more logs when there is no scroll', async () => {
        const loadMoreMock = jest.fn();
        const { element, events } = getMockElement(0);
        element.clientHeight = 40;
        element.scrollHeight = element.clientHeight;

        const { scrollTo } = setup(loadMoreMock, 0, logs, order, undefined, { element, events });

        expect(await screen.findByText('log line 1')).toBeInTheDocument();

        scrollTo(39, 1);
        scrollTo(40, 600);

        expect(loadMoreMock).not.toHaveBeenCalled();
        expect(screen.queryByTestId('Spinner')).not.toBeInTheDocument();
      });

      test('Requests newer logs from the most recent timestamp', async () => {
        const startPosition = order === LogsSortOrder.Descending ? 10 : 50; // Scroll top
        const endPosition = order === LogsSortOrder.Descending ? 0 : 60; // Scroll bottom

        const loadMoreMock = jest.fn();
        const { scrollTo } = setup(loadMoreMock, startPosition, logs, order);

        expect(await screen.findByText('log line 1')).toBeInTheDocument();

        scrollTo(endPosition - 1, 1);
        scrollTo(endPosition, 600);

        expect(loadMoreMock).toHaveBeenCalledWith(
          {
            from: logs[logs.length - 1].timeEpochMs,
            to: absoluteRange.to,
          },
          order === LogsSortOrder.Descending ? -1 : 1
        );
      });

      test('Requests older logs from the oldest timestamp', async () => {
        const startPosition = order === LogsSortOrder.Ascending ? 10 : 50; // Scroll top
        const endPosition = order === LogsSortOrder.Ascending ? 0 : 60; // Scroll bottom

        const loadMoreMock = jest.fn();
        const { scrollTo } = setup(loadMoreMock, startPosition, logs, order);

        expect(await screen.findByText('log line 1')).toBeInTheDocument();

        scrollTo(endPosition - 1, 1);
        scrollTo(endPosition, 600);

        expect(loadMoreMock).toHaveBeenCalledWith(
          {
            from: absoluteRange.from,
            to: logs[0].timeEpochMs,
          },
          order === LogsSortOrder.Ascending ? -1 : 1
        );
      });

      describe('With absolute range matching visible range', () => {
        test('It does not request more when scrolling bottom', async () => {
          // Visible range matches the current range
          const logs = createLogs(absoluteRange.from, absoluteRange.to);
          const loadMoreMock = jest.fn();
          const { scrollTo } = setup(loadMoreMock, 50, logs, order);

          expect(await screen.findByText('log line 1')).toBeInTheDocument();

          scrollTo(59, 1);
          scrollTo(60, 600);

          expect(loadMoreMock).not.toHaveBeenCalled();
          expect(screen.queryByTestId('Spinner')).not.toBeInTheDocument();
          expect(await screen.findByText('End of the selected time range.')).toBeInTheDocument();
        });
      });

      describe('With relative range matching visible range', () => {
        test('It does not request more when scrolling bottom', async () => {
          // Visible range matches the current range
          const logs = createLogs(absoluteRange.from, absoluteRange.to);
          const loadMoreMock = jest.fn();
          const { scrollTo } = setup(loadMoreMock, 50, logs, order);

          expect(await screen.findByText('log line 1')).toBeInTheDocument();

          scrollTo(59, 1);
          scrollTo(60, 600);

          expect(loadMoreMock).not.toHaveBeenCalled();
          expect(screen.queryByTestId('Spinner')).not.toBeInTheDocument();
          expect(await screen.findByText('End of the selected time range.')).toBeInTheDocument();
        });
      });

      describe('Chain of events', () => {
        test('Ingnores chains of events', async () => {
          const loadMoreMock = jest.fn();
          const { wheel } = setup(loadMoreMock, 57, logs, order);

          expect(await screen.findByText('log line 1')).toBeInTheDocument();

          const timeStamps = [1, 2, 3, 4];
          timeStamps.forEach((timeStamp) => {
            wheel(1, timeStamp);
          });

          expect(loadMoreMock).not.toHaveBeenCalled();
        });

        test('Detects when chain of events ends', async () => {
          const loadMoreMock = jest.fn();
          const { wheel } = setup(loadMoreMock, 57, logs, order);

          expect(await screen.findByText('log line 1')).toBeInTheDocument();

          const timeStamps = [1, 2, 3, 600, 1];
          timeStamps.forEach((timeStamp) => {
            wheel(1, timeStamp);
          });

          expect(loadMoreMock).toHaveBeenCalledTimes(1);
        });

        test('Detects when the user wants to scroll', async () => {
          const loadMoreMock = jest.fn();
          const { wheel } = setup(loadMoreMock, 57, logs, order);

          expect(await screen.findByText('log line 1')).toBeInTheDocument();

          for (let i = 0; i <= 25; i++) {
            wheel(1, 399 * i + 399);
          }

          expect(loadMoreMock).toHaveBeenCalledTimes(1);
        });
      });

      describe('With scroll mode unlimited', () => {
        test('Allows infinite scroll in the top direction', async () => {
          const loadMoreMock = jest.fn();
          const { wheel } = setup(loadMoreMock, 0, logs, order, 'unlimited');

          expect(await screen.findByText('log line 1')).toBeInTheDocument();

          wheel(-5, 1);
          wheel(-5, 600);

          expect(loadMoreMock).toHaveBeenCalledWith(expect.anything(), ScrollDirection.Top);
        });
      });
    }
  );
});

function createLogs(from: number, to: number) {
  const rows = [
    createLogLine({ entry: 'log line 1', uid: 'log-1' }),
    createLogLine({ entry: 'log line 2', uid: 'log-22' }),
  ];
  // Time field
  rows[0].dataFrame.fields[0].values = [from, to];
  rows[0].timeEpochMs = from;
  rows[1].dataFrame.fields[0].values = [from, to];
  rows[1].timeEpochMs = to;
  return rows;
}

// JSDOM doesn't support layout, so we will mock the expected attribute values for the test cases.
function getMockElement(scrollTop: number) {
  const events: Record<string, (e: Event | WheelEvent) => void> = {};
  const element = {
    addEventListener: (event: string, callback: (e: Event | WheelEvent) => void) => {
      events[event] = callback;
    },
    removeEventListener: jest.fn(),
    stopImmediatePropagation: jest.fn(),
    scrollHeight: 100,
    clientHeight: 40,
    scrollTop,
    scrollTo: jest.fn(),
    scroll: jest.fn(),
  };

  return { element, events };
}
