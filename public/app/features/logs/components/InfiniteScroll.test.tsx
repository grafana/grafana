import { act, render, screen } from '@testing-library/react';
import React, { useEffect, useRef, useState } from 'react';

import { LogRowModel, dateTimeForTimeZone } from '@grafana/data';
import { convertRawToRange } from '@grafana/data/src/datetime/rangeutil';
import { LogsSortOrder } from '@grafana/schema';

import { InfiniteScroll, Props, SCROLLING_THRESHOLD } from './InfiniteScroll';
import { createLogRow } from './__mocks__/logRow';

const defaultTz = 'browser';

const absoluteRange = {
  from: 1702578600000,
  to: 1702578900000,
};
const defaultRange = convertRawToRange({
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
        <InfiniteScroll {...props} scrollElement={scrollRef.current!}>
          {children}
        </InfiniteScroll>
      )}
    </div>
  );
}

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
        rows = createLogRows(absoluteRange.from + (2 * SCROLLING_THRESHOLD), absoluteRange.to - (2 * SCROLLING_THRESHOLD));
      });

      function setup(loadMoreMock: () => void, startPosition: number) {
        const { element, events } = getMockElement(startPosition);
        render(
          <InfiniteScroll
            {...defaultProps}
            sortOrder={order}
            rows={rows}
            scrollElement={element as unknown as HTMLDivElement}
            loadMoreLogs={loadMoreMock}
          >
            <div data-testid="contents" style={{ height: 100 }} />
          </InfiniteScroll>
        );
        return { element, events };
      }

      test.each([
        ['top', 10, 0],
        ['bottom', 90, 100],
      ])('Requests more logs when scrolling %s', async (_: string, startPosition: number, endPosition: number) => {
        const loadMoreMock = jest.fn();
        const { element, events } = setup(loadMoreMock, startPosition);

        expect(await screen.findByTestId('contents')).toBeInTheDocument();
        element.scrollTop = endPosition;

        act(() => {
          events['scroll'](new Event('scroll'));
        });

        expect(loadMoreMock).toHaveBeenCalled();
        expect(await screen.findByTestId('Spinner')).toBeInTheDocument();
      });

      test.each([
        ['up', -5, 0],
        ['down', 5, 100],
      ])(
        'Requests more logs when moving the mousewheel %s',
        async (_: string, deltaY: number, startPosition: number) => {
          const loadMoreMock = jest.fn();
          const { events } = setup(loadMoreMock, startPosition);

          expect(await screen.findByTestId('contents')).toBeInTheDocument();

          act(() => {
            const event = new WheelEvent('wheel', { deltaY });
            events['wheel'](event);
          });

          expect(loadMoreMock).toHaveBeenCalled();
          expect(await screen.findByTestId('Spinner')).toBeInTheDocument();
        }
      );

      test('Does not request more logs when there is no scroll', async () => {
        const loadMoreMock = jest.fn();
        const { element, events } = setup(loadMoreMock, 0);

        expect(await screen.findByTestId('contents')).toBeInTheDocument();
        element.clientHeight = 40;
        element.scrollHeight = element.clientHeight;

        act(() => {
          events['scroll'](new Event('scroll'));
        });

        expect(loadMoreMock).not.toHaveBeenCalled();
        expect(screen.queryByTestId('Spinner')).not.toBeInTheDocument();
      });

      describe('With absolute range', () => {
        function setup(loadMoreMock: () => void, startPosition: number, rows: LogRowModel[]) {
          const { element, events } = getMockElement(startPosition);
          render(
            <InfiniteScroll
              {...defaultProps}
              sortOrder={order}
              rows={rows}
              scrollElement={element as unknown as HTMLDivElement}
              loadMoreLogs={loadMoreMock}
            >
              <div data-testid="contents" style={{ height: 100 }} />
            </InfiniteScroll>
          );
          return { element, events };
        }

        test.each([
          ['top', 10, 0],
          ['bottom', 90, 100],
        ])(
          'It does not request more when scrolling %s',
          async (_: string, startPosition: number, endPosition: number) => {
            const rows = createLogRows(absoluteRange.from, absoluteRange.to);
            const loadMoreMock = jest.fn();
            const { element, events } = setup(loadMoreMock, startPosition, rows);

            expect(await screen.findByTestId('contents')).toBeInTheDocument();
            element.scrollTop = endPosition;

            act(() => {
              events['scroll'](new Event('scroll'));
            });

            expect(loadMoreMock).not.toHaveBeenCalled();
            expect(screen.queryByTestId('Spinner')).not.toBeInTheDocument();
          }
        );
      });
    }
  );
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
  };

  return { element, events };
}
