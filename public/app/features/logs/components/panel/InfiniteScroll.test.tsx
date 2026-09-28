import { act, render, screen } from '@testing-library/react';
import { VariableSizeList } from 'react-window';

import { createTheme, dateTimeForTimeZone, LoadingState, rangeUtil } from '@grafana/data';
import { LogsSortOrder } from '@grafana/schema';

import { ScrollDirection, SCROLLING_THRESHOLD } from '../infiniteScrollUtils';
import { createLogLine } from '../mocks/logRow';

import { InfiniteScroll, type InfiniteScrollMode, type Props } from './InfiniteScroll';
import { type LogListModel } from './processing';
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

// Regression tests for https://github.com/grafana/grafana/issues/129033 (infinite scroll stopping early).
describe('InfiniteScroll consecutive loads (regression #129033)', () => {
  // Page 1 sits early in the range so canScrollBottom returns a valid next window.
  const pageFrom = absoluteRange.from + 2 * SCROLLING_THRESHOLD;
  const pageTo = absoluteRange.from + 50 * SCROLLING_THRESHOLD;

  // n log lines spread across [pageFrom, pageTo] (oldest first), a fresh array each call.
  function makeLogs(n: number): LogListModel[] {
    return Array.from({ length: n }, (_, i) => {
      const ts = pageFrom + Math.round(((pageTo - pageFrom) * i) / Math.max(n - 1, 1));
      return createLogLine({ entry: `line ${i}`, uid: `log-${i}`, timeEpochMs: ts });
    });
  }

  function ui(
    currentLogs: LogListModel[],
    element: ReturnType<typeof getMockElement>['element'],
    loadMore: jest.Mock,
    loadingState: LoadingState = LoadingState.Done
  ) {
    return (
      <InfiniteScroll
        {...defaultProps}
        sortOrder={LogsSortOrder.Ascending}
        logs={currentLogs}
        scrollElement={element as unknown as HTMLDivElement}
        loadMore={loadMore}
        loadingState={loadingState}
        infiniteScrollMode="interval"
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
  }

  function scroll(
    element: { scrollTop: number },
    events: Record<string, (e: Event | WheelEvent) => void>,
    position: number,
    timeStamp: number
  ) {
    element.scrollTop = position;
    act(() => {
      const event = new Event('scroll');
      jest.spyOn(event, 'timeStamp', 'get').mockReturnValue(timeStamp);
      events['scroll'](event);
    });
  }

  test('resolves to idle when a settled load-more returns new rows (Ascending)', async () => {
    const loadMoreMock = jest.fn();
    const { element, events } = getMockElement(50);

    const page1 = createLogs(pageFrom, pageTo);
    const { rerender } = render(ui(page1, element, loadMoreMock, LoadingState.Done));

    expect(await screen.findByText('log line 1')).toBeInTheDocument();

    // First scroll to the bottom triggers the first load-more.
    scroll(element, events, 59, 1);
    scroll(element, events, 60, 600);
    expect(loadMoreMock).toHaveBeenCalledTimes(1);

    // In flight: an intermediate same-length emission must not latch 'out-of-bounds'.
    act(() => {
      rerender(ui(createLogs(pageFrom, pageTo), element, loadMoreMock, LoadingState.Loading));
    });
    expect(screen.queryByText('End of the selected time range.')).not.toBeInTheDocument();

    // Settles with new rows -> idle, not end-of-range.
    const grown = [...page1, createLogLine({ entry: 'log line 3', uid: 'log-3', timeEpochMs: pageTo })];
    act(() => {
      rerender(ui(grown, element, loadMoreMock, LoadingState.Done));
    });
    expect(screen.queryByText('End of the selected time range.')).not.toBeInTheDocument();
  });

  test('flags out-of-bounds only when a settled load-more returns no new rows (Ascending)', async () => {
    const loadMoreMock = jest.fn();
    const { element, events } = getMockElement(50);

    const page1 = createLogs(pageFrom, pageTo);
    const { rerender } = render(ui(page1, element, loadMoreMock, LoadingState.Done));

    expect(await screen.findByText('log line 1')).toBeInTheDocument();

    scroll(element, events, 59, 1);
    scroll(element, events, 60, 600);
    expect(loadMoreMock).toHaveBeenCalledTimes(1);

    // Settles with the same row count -> genuine end of range (fresh array each emission).
    act(() => {
      rerender(ui(createLogs(pageFrom, pageTo), element, loadMoreMock, LoadingState.Loading));
    });
    act(() => {
      rerender(ui(createLogs(pageFrom, pageTo), element, loadMoreMock, LoadingState.Done));
    });

    expect(await screen.findByText('End of the selected time range.')).toBeInTheDocument();
  });

  test('does not flag end-of-range when query splitting grows rows across in-flight emissions (Ascending)', async () => {
    const loadMoreMock = jest.fn();
    const { element, events } = getMockElement(50);

    const { rerender } = render(ui(makeLogs(2), element, loadMoreMock, LoadingState.Done));
    expect(await screen.findByText('line 0')).toBeInTheDocument();

    scroll(element, events, 59, 1);
    scroll(element, events, 60, 600);
    expect(loadMoreMock).toHaveBeenCalledTimes(1);

    // Query splitting grows the rows across in-flight emissions...
    act(() => {
      rerender(ui(makeLogs(4), element, loadMoreMock, LoadingState.Loading));
    });
    act(() => {
      rerender(ui(makeLogs(6), element, loadMoreMock, LoadingState.Loading));
    });
    // ...and Done carries the same rows as the last emission; comparing against the start count (2 -> 6) -> idle.
    act(() => {
      rerender(ui(makeLogs(6), element, loadMoreMock, LoadingState.Done));
    });

    expect(screen.queryByText('End of the selected time range.')).not.toBeInTheDocument();
  });

  test('treats Streaming emissions as in flight, settling only on Done (Ascending)', async () => {
    const loadMoreMock = jest.fn();
    const { element, events } = getMockElement(50);

    const page1 = createLogs(pageFrom, pageTo);
    const { rerender } = render(ui(page1, element, loadMoreMock, LoadingState.Done));

    expect(await screen.findByText('log line 1')).toBeInTheDocument();

    scroll(element, events, 59, 1);
    scroll(element, events, 60, 600);
    expect(loadMoreMock).toHaveBeenCalledTimes(1);

    // Streaming emissions must count as in flight — no settle or end-of-range mid-stream.
    act(() => {
      rerender(ui(createLogs(pageFrom, pageTo), element, loadMoreMock, LoadingState.Streaming));
    });
    expect(await screen.findByTestId('Spinner')).toBeInTheDocument();
    expect(screen.queryByText('End of the selected time range.')).not.toBeInTheDocument();

    // Settles on Done with new rows -> idle.
    const grown = [...page1, createLogLine({ entry: 'log line 3', uid: 'log-3', timeEpochMs: pageTo })];
    act(() => {
      rerender(ui(grown, element, loadMoreMock, LoadingState.Done));
    });
    expect(screen.queryByText('End of the selected time range.')).not.toBeInTheDocument();
  });

  test('recovers to idle (not stuck) when a load-more errors (Ascending)', async () => {
    const loadMoreMock = jest.fn();
    const { element, events } = getMockElement(50);

    const page1 = createLogs(pageFrom, pageTo);
    const { rerender } = render(ui(page1, element, loadMoreMock, LoadingState.Done));

    expect(await screen.findByText('log line 1')).toBeInTheDocument();

    scroll(element, events, 59, 1);
    scroll(element, events, 60, 600);
    expect(loadMoreMock).toHaveBeenCalledTimes(1);

    // In flight: the loading spinner is shown.
    act(() => {
      rerender(ui(createLogs(pageFrom, pageTo), element, loadMoreMock, LoadingState.Loading));
    });
    expect(await screen.findByTestId('Spinner')).toBeInTheDocument();

    // Errors (no new rows) must return to idle, not stick on the spinner or latch end-of-range.
    act(() => {
      rerender(ui(page1, element, loadMoreMock, LoadingState.Error));
    });
    expect(screen.queryByTestId('Spinner')).not.toBeInTheDocument();
    expect(screen.queryByText('End of the selected time range.')).not.toBeInTheDocument();
  });

  test('re-running the query clears a stale out-of-bounds (Ascending)', async () => {
    const loadMoreMock = jest.fn();
    const { element, events } = getMockElement(50);

    const page1 = createLogs(pageFrom, pageTo);
    const { rerender } = render(ui(page1, element, loadMoreMock, LoadingState.Done));

    expect(await screen.findByText('log line 1')).toBeInTheDocument();

    // Reach out-of-bounds: a settled load-more returns no new rows.
    scroll(element, events, 59, 1);
    scroll(element, events, 60, 600);
    act(() => {
      rerender(ui(createLogs(pageFrom, pageTo), element, loadMoreMock, LoadingState.Loading));
    });
    act(() => {
      rerender(ui(createLogs(pageFrom, pageTo), element, loadMoreMock, LoadingState.Done));
    });
    expect(await screen.findByText('End of the selected time range.')).toBeInTheDocument();

    // Re-running the query replaces the logs (not a load-more); the stale out-of-bounds must clear.
    act(() => {
      rerender(ui(makeLogs(3), element, loadMoreMock, LoadingState.Done));
    });
    expect(screen.queryByText('End of the selected time range.')).not.toBeInTheDocument();
  });
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
