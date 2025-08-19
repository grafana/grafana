import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect, useRef, useState } from 'react';

import { CoreApp, LogRowModel, dateTimeForTimeZone, rangeUtil } from '@grafana/data';
import { config } from '@grafana/runtime';
import { LogsSortOrder } from '@grafana/schema';

import { InfiniteScroll, Props, SCROLLING_THRESHOLD } from './InfiniteScroll';
import { createLogRow } from './mocks/logRow';

const defaultTz = 'browser';

const absoluteRange = {
  from: 1702578600000,
  to: 1702578900000,
};
const defaultRange = rangeUtil.convertRawToRange({
  from: dateTimeForTimeZone(defaultTz, absoluteRange.from),
  to: dateTimeForTimeZone(defaultTz, absoluteRange.to),
});

const defaultProps: Omit<Props, 'children'> = {
  loading: false,
  loadMoreLogs: jest.fn(),
  range: defaultRange,
  rows: [],
  sortOrder: LogsSortOrder.Descending,
  timeZone: 'browser',
  scrollElement: null,
};

function ScrollWithWrapper({ children, ...props }: Props) {
  const [initialized, setInitialized] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Required to get the ref
    if (scrollRef.current && !initialized) {
      setInitialized(true);
    }
  }, [initialized]);

  return (
    <div style={{ height: 40, overflowY: 'scroll' }} ref={scrollRef} data-testid="scroll-element">
      {initialized && (
        <InfiniteScroll {...props} scrollElement={scrollRef.current!} topScrollEnabled>
          {children}
        </InfiniteScroll>
      )}
    </div>
  );
}

function setup(
  loadMoreMock: () => void,
  startPosition: number,
  rows: LogRowModel[],
  order: LogsSortOrder,
  app?: CoreApp,
  { element, events } = getMockElement(startPosition)
) {
  function scrollTo(position: number, timeStamp?: number) {
    element.scrollTop = position;

    act(() => {
      const event = new Event('scroll');
      if (timeStamp) {
        jest.spyOn(event, 'timeStamp', 'get').mockReturnValue(timeStamp);
      }
      events['scroll']?.(event);
    });

    // When scrolling top, we wait for the user to reach the top, and then for a new scrolling event
    // in the same direction before triggering a new query.
    if (position === 0) {
      wheel(-1);
    }
  }
  function wheel(deltaY: number, timeStamp?: number) {
    element.scrollTop += deltaY;

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
      rows={rows}
      scrollElement={element as unknown as HTMLDivElement}
      loadMoreLogs={loadMoreMock}
      topScrollEnabled
      app={app}
    >
      <div data-testid="contents" style={{ height: 100 }} />
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
  test('Wraps components without adding DOM elements', async () => {
    const { container } = render(
      <ScrollWithWrapper {...defaultProps}>
        <div data-testid="contents" />
      </ScrollWithWrapper>
    );

    expect(await screen.findByTestId('contents')).toBeInTheDocument();
    expect(container).toMatchInlineSnapshot(`
      <div>
        <div
          data-testid="scroll-element"
          style="height: 40px; overflow-y: scroll;"
        >
          <div
            data-testid="contents"
          />
        </div>
      </div>
`);
  });

  describe.each([LogsSortOrder.Descending, LogsSortOrder.Ascending])(
    'When the sort order is %s',
    (order: LogsSortOrder) => {
      let rows: LogRowModel[];
      beforeEach(() => {
        rows = createLogRows(absoluteRange.from + 2 * SCROLLING_THRESHOLD, absoluteRange.to - 2 * SCROLLING_THRESHOLD);
      });

      test.each([
        ['top', 10, 0],
        ['bottom', 50, 60],
      ])(
        'Requests more logs when scrolling %s',
        async (direction: string, startPosition: number, endPosition: number) => {
          const loadMoreMock = jest.fn();
          const { scrollTo, element } = setup(loadMoreMock, startPosition, rows, order);

          expect(await screen.findByTestId('contents')).toBeInTheDocument();

          scrollTo(endPosition - 1, 1);
          scrollTo(endPosition, 600);

          expect(loadMoreMock).toHaveBeenCalled();
          expect(await screen.findByTestId('Spinner')).toBeInTheDocument();
          if (direction === 'bottom') {
            // Bottom loader visibility trick
            expect(element.scrollTo).toHaveBeenCalled();
          } else {
            expect(element.scrollTo).not.toHaveBeenCalled();
          }
        }
      );

      test.each([
        ['up', -5, 0],
        ['down', 5, 60],
      ])(
        'Requests more logs when moving the mousewheel %s',
        async (_: string, deltaY: number, startPosition: number) => {
          const loadMoreMock = jest.fn();
          const { wheel } = setup(loadMoreMock, startPosition, rows, order);

          expect(await screen.findByTestId('contents')).toBeInTheDocument();

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

        const { scrollTo } = setup(loadMoreMock, 0, rows, order, undefined, { element, events });

        expect(await screen.findByTestId('contents')).toBeInTheDocument();

        scrollTo(39, 1);
        scrollTo(40, 600);

        expect(loadMoreMock).not.toHaveBeenCalled();
        expect(screen.queryByTestId('Spinner')).not.toBeInTheDocument();
      });

      test('Requests newer logs from the most recent timestamp', async () => {
        const startPosition = order === LogsSortOrder.Descending ? 10 : 50; // Scroll top
        const endPosition = order === LogsSortOrder.Descending ? 0 : 60; // Scroll bottom

        const loadMoreMock = jest.fn();
        const { scrollTo } = setup(loadMoreMock, startPosition, rows, order);

        expect(await screen.findByTestId('contents')).toBeInTheDocument();

        scrollTo(endPosition - 1, 1);
        scrollTo(endPosition, 600);

        expect(loadMoreMock).toHaveBeenCalledWith({
          from: rows[rows.length - 1].timeEpochMs,
          to: absoluteRange.to,
        });
      });

      test('Requests older logs from the oldest timestamp', async () => {
        const startPosition = order === LogsSortOrder.Ascending ? 10 : 50; // Scroll top
        const endPosition = order === LogsSortOrder.Ascending ? 0 : 60; // Scroll bottom

        const loadMoreMock = jest.fn();
        const { scrollTo } = setup(loadMoreMock, startPosition, rows, order);

        expect(await screen.findByTestId('contents')).toBeInTheDocument();

        scrollTo(endPosition - 1, 1);
        scrollTo(endPosition, 600);

        expect(loadMoreMock).toHaveBeenCalledWith({
          from: absoluteRange.from,
          to: rows[0].timeEpochMs,
        });
      });

      describe('With absolute range matching visible range', () => {
        test.each([
          ['top', 10, 0],
          ['bottom', 50, 60],
        ])(
          'It does not request more when scrolling %s',
          async (_: string, startPosition: number, endPosition: number) => {
            // Visible range matches the current range
            const rows = createLogRows(absoluteRange.from, absoluteRange.to);
            const loadMoreMock = jest.fn();
            const { scrollTo } = setup(loadMoreMock, startPosition, rows, order);

            expect(await screen.findByTestId('contents')).toBeInTheDocument();

            scrollTo(endPosition - 1, 1);
            scrollTo(endPosition, 600);

            expect(loadMoreMock).not.toHaveBeenCalled();
            expect(screen.queryByTestId('Spinner')).not.toBeInTheDocument();
            expect(await screen.findByTestId('end-of-range')).toBeInTheDocument();
          }
        );
      });

      describe('With relative range matching visible range', () => {
        test.each([
          ['top', 10, 0],
          ['bottom', 50, 60],
        ])(
          'It does not request more when scrolling %s',
          async (_: string, startPosition: number, endPosition: number) => {
            // Visible range matches the current range
            const rows = createLogRows(absoluteRange.from, absoluteRange.to);
            const loadMoreMock = jest.fn();
            const { scrollTo } = setup(loadMoreMock, startPosition, rows, order);

            expect(await screen.findByTestId('contents')).toBeInTheDocument();

            scrollTo(endPosition - 1, 1);
            scrollTo(endPosition, 600);

            expect(loadMoreMock).not.toHaveBeenCalled();
            expect(screen.queryByTestId('Spinner')).not.toBeInTheDocument();
            expect(await screen.findByTestId('end-of-range')).toBeInTheDocument();
          }
        );
      });

      describe('Chain of events', () => {
        test('Ingnores chains of events', async () => {
          const loadMoreMock = jest.fn();
          const { wheel } = setup(loadMoreMock, 57, rows, order);

          expect(await screen.findByTestId('contents')).toBeInTheDocument();

          const timeStamps = [1, 2, 3, 4];
          timeStamps.forEach((timeStamp) => {
            wheel(1, timeStamp);
          });

          expect(loadMoreMock).not.toHaveBeenCalled();
        });

        test('Detects when chain of events ends', async () => {
          const loadMoreMock = jest.fn();
          const { wheel } = setup(loadMoreMock, 57, rows, order);

          expect(await screen.findByTestId('contents')).toBeInTheDocument();

          const timeStamps = [1, 2, 3, 600, 1];
          timeStamps.forEach((timeStamp) => {
            wheel(1, timeStamp);
          });

          expect(loadMoreMock).toHaveBeenCalledTimes(1);
        });

        test('Detects when the user wants to scroll', async () => {
          const loadMoreMock = jest.fn();
          const { wheel } = setup(loadMoreMock, 57, rows, order);

          expect(await screen.findByTestId('contents')).toBeInTheDocument();

          for (let i = 0; i <= 25; i++) {
            wheel(1, 399 * i + 399);
          }

          expect(loadMoreMock).toHaveBeenCalledTimes(1);
        });
      });
    }
  );

  describe('In Explore', () => {
    test('Requests older logs from the oldest timestamp', async () => {
      const loadMoreMock = jest.fn();
      const rows = createLogRows(
        absoluteRange.from + 2 * SCROLLING_THRESHOLD,
        absoluteRange.to - 2 * SCROLLING_THRESHOLD
      );
      setup(loadMoreMock, 0, rows, LogsSortOrder.Ascending, CoreApp.Explore);

      expect(await screen.findByTestId('contents')).toBeInTheDocument();

      await screen.findByText('Older logs');

      await userEvent.click(screen.getByText('Older logs'));

      expect(loadMoreMock).toHaveBeenCalledWith({
        from: absoluteRange.from,
        to: rows[0].timeEpochMs,
      });
    });
  });
});

function createLogRows(from: number, to: number) {
  const rows = [createLogRow({ entry: 'line1' }), createLogRow({ entry: 'line2' })];
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
