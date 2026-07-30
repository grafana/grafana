import { render, screen, waitFor, userEvent } from 'test/test-utils';

import {
  createDataFrame,
  FieldType,
  LoadingState,
  LogRowContextQueryDirection,
  LogsSortOrder,
  type SplitOpenOptions,
} from '@grafana/data';
import { setTestFlags } from '@grafana/test-utils/unstable';

import { dataFrameToLogsModel } from '../../logsModel';
import { LOG_LINE_BODY_FIELD_NAME, OTEL_LOG_LINE_ATTRIBUTES_FIELD_NAME } from '../fieldSelector/logFields';
import {
  getDisplayedFieldsForLogs,
  getOtelAttributesField,
  identifyOTelLanguage,
  identifyOTelLanguages,
} from '../otel/formats';

import { combineLoadingStates, DEFAULT_TIME_WINDOW, LogLineContext, PAGE_SIZE } from './LogLineContext';

const setBooleanFlags = (flags: Record<string, boolean>) => {
  setTestFlags(flags);
};

jest.mock('@grafana/assistant', () => ({
  ...jest.requireActual('@grafana/assistant'),
  useAssistant: jest.fn().mockReturnValue({
    isLoading: false,
    isAvailable: true,
    openAssistant: jest.fn(),
  }),
}));
jest.mock('../otel/formats');

const dfBefore = createDataFrame({
  fields: [
    {
      name: 'time',
      type: FieldType.time,
      values: ['2019-04-26T07:28:11.352440161Z', '2019-04-26T09:28:11.352440161Z'],
    },
    {
      name: 'message',
      type: FieldType.string,
      values: ['foo123', 'foo123'],
    },
  ],
});
const dfNow = createDataFrame({
  fields: [
    {
      name: 'time',
      type: FieldType.time,
      values: ['2019-04-26T09:28:11.352440161Z'],
    },
    {
      name: 'message',
      type: FieldType.string,
      values: ['foo123'],
    },
  ],
});
const dfAfter = createDataFrame({
  fields: [
    {
      name: 'time',
      type: FieldType.time,
      values: ['2019-04-26T14:42:50.991981292Z', '2019-04-26T16:28:11.352440161Z'],
    },
    {
      name: 'message',
      type: FieldType.string,
      values: ['foo123', 'bar123'],
    },
  ],
});

// Rows of a burst of logs sharing a timestamp, as [milliseconds, log line] pairs.
type BurstRow = [number, string];
const BURST_MS = 1700000000000;
const burstFrame = (rows: BurstRow[], refId: string) =>
  createDataFrame({
    // Row uids are derived from the refId, and duplicated uids break rendering.
    refId,
    fields: [
      { name: 'time', type: FieldType.time, values: rows.map(([ms]) => ms) },
      { name: 'message', type: FieldType.string, values: rows.map(([, line]) => line) },
      // Nanoseconds are strings: epoch nanoseconds do not fit in a JS number.
      { name: 'tsNs', type: FieldType.string, values: rows.map(([ms]) => `${ms}000000`) },
    ],
  });

let getRowContext = jest.fn();
const dispatchMock = jest.fn();
jest.mock('app/types/store', () => ({
  ...jest.requireActual('app/types/store'),
  useDispatch: () => dispatchMock,
}));

const splitOpenSym = Symbol('splitOpen');
const splitOpen = jest.fn().mockReturnValue(splitOpenSym);
jest.mock('app/features/explore/state/main', () => ({
  ...jest.requireActual('app/features/explore/state/main'),
  splitOpen: (arg?: SplitOpenOptions) => {
    return splitOpen(arg);
  },
}));

jest.mocked(getDisplayedFieldsForLogs).mockReturnValue([]);
jest.mocked(identifyOTelLanguages).mockReturnValue([]);

const logs = dataFrameToLogsModel([dfNow]);
const row = logs.rows[0];

const timeZone = 'UTC';

describe('LogLineContext', () => {
  beforeEach(() => {
    setBooleanFlags({});
  });

  let uniqueRefIdCounter = 1;

  beforeEach(() => {
    uniqueRefIdCounter = 1;
    getRowContext = jest.fn().mockImplementation(async (_, options) => {
      uniqueRefIdCounter += 1;
      const refId = `refid_${uniqueRefIdCounter}`;
      if (options.direction === LogRowContextQueryDirection.Forward) {
        return {
          data: [
            {
              refId,
              ...dfBefore,
            },
          ],
        };
      } else {
        return {
          data: [
            {
              refId,
              ...dfAfter,
            },
          ],
        };
      }
    });
  });

  test('Should not render when it is closed', async () => {
    render(
      <LogLineContext
        log={row}
        open={false}
        onClose={() => {}}
        getRowContext={getRowContext}
        timeZone={timeZone}
        sortOrder={LogsSortOrder.Descending}
      />
    );

    await waitFor(() => expect(screen.queryByText('Log context')).not.toBeInTheDocument());
  });

  test('Should render when it is open', async () => {
    render(
      <LogLineContext
        log={row}
        open={true}
        onClose={() => {}}
        getRowContext={getRowContext}
        timeZone={timeZone}
        sortOrder={LogsSortOrder.Descending}
      />
    );

    await waitFor(() => expect(screen.queryByText('Log context')).toBeInTheDocument());
  });

  test('Should call not getRowContext when closed', async () => {
    render(
      <LogLineContext
        log={row}
        open={false}
        onClose={() => {}}
        getRowContext={getRowContext}
        timeZone={timeZone}
        sortOrder={LogsSortOrder.Descending}
      />
    );

    await waitFor(() => expect(getRowContext).not.toHaveBeenCalled());
  });

  test('Should call getRowContext on open', async () => {
    render(
      <LogLineContext
        log={row}
        open={true}
        onClose={() => {}}
        getRowContext={getRowContext}
        timeZone={timeZone}
        sortOrder={LogsSortOrder.Descending}
      />
    );
    await waitFor(() => expect(getRowContext).toHaveBeenCalledTimes(2));
  });

  test('should render 3 lines containing `foo123`', async () => {
    render(
      <LogLineContext
        log={row}
        open={true}
        onClose={() => {}}
        getRowContext={getRowContext}
        timeZone={timeZone}
        sortOrder={LogsSortOrder.Descending}
      />
    );
    // 1 in before, 1 in current, 1 in after
    await waitFor(() => expect(screen.getAllByText('foo123').length).toBe(3));
  });

  test('should render 3 lines containing `foo123` with the same ms timestamp', async () => {
    const dfBeforeNs = createDataFrame({
      fields: [
        {
          name: 'time',
          type: FieldType.time,
          values: [1, 1],
        },
        {
          name: 'message',
          type: FieldType.string,
          values: ['foo123', 'foo123'],
        },
        {
          name: 'tsNs',
          type: FieldType.string,
          values: ['1', '2'],
        },
      ],
    });
    const dfNowNs = createDataFrame({
      fields: [
        {
          name: 'time',
          type: FieldType.time,
          values: [1],
        },
        {
          name: 'message',
          type: FieldType.string,
          values: ['foo123'],
        },
        {
          name: 'tsNs',
          type: FieldType.string,
          values: ['2'],
        },
      ],
    });
    const dfAfterNs = createDataFrame({
      fields: [
        {
          name: 'time',
          type: FieldType.time,
          values: [1, 1],
        },
        {
          name: 'message',
          type: FieldType.string,
          values: ['foo123', 'foo123'],
        },
        {
          name: 'tsNs',
          type: FieldType.string,
          values: ['2', '3'],
        },
      ],
    });

    let uniqueRefIdCounter = 1;
    const logs = dataFrameToLogsModel([dfNowNs]);
    const row = logs.rows[0];
    const getRowContext = jest.fn().mockImplementation(async (_, options) => {
      uniqueRefIdCounter += 1;
      const refId = `refid_${uniqueRefIdCounter}`;
      if (uniqueRefIdCounter === 2) {
        return {
          data: [
            {
              refId,
              ...dfBeforeNs,
            },
          ],
        };
      } else if (uniqueRefIdCounter === 3) {
        return {
          data: [
            {
              refId,
              ...dfAfterNs,
            },
          ],
        };
      }
      return { data: [] };
    });

    render(
      <LogLineContext
        log={row}
        open={true}
        onClose={() => {}}
        getRowContext={getRowContext}
        timeZone={timeZone}
        sortOrder={LogsSortOrder.Descending}
      />
    );

    // 1 in before, 1 in current, 1 in after
    await waitFor(() => {
      expect(screen.getAllByText('foo123').length).toBe(3);
    });
  });

  test('should render rows sharing the selected row timestamp once', async () => {
    const selected = dataFrameToLogsModel([
      // The gate reads repeats off the original result, so the frame must contain a sibling.
      burstFrame(
        [
          [BURST_MS, 'selected'],
          [BURST_MS, 'a sibling in the original result'],
        ],
        'anchor'
      ),
    ]).rows[0];
    const getRowContext = jest.fn().mockImplementation(async (_, options) => ({
      data: [
        burstFrame(
          // A data source with an end-inclusive range returns the burst in both directions.
          options.direction === LogRowContextQueryDirection.Forward
            ? [
                [BURST_MS, 'selected'],
                [BURST_MS, 'burst 1'],
                [BURST_MS, 'burst 2'],
              ]
            : [
                [BURST_MS, 'selected'],
                [BURST_MS, 'burst 1'],
                [BURST_MS, 'burst 2'],
                [BURST_MS - 1, 'before the burst'],
              ],
          `context-${options.direction}`
        ),
      ],
    }));

    render(
      <LogLineContext
        log={selected}
        open={true}
        onClose={() => {}}
        getRowContext={getRowContext}
        timeZone={timeZone}
        sortOrder={LogsSortOrder.Descending}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('before the burst')).toBeInTheDocument();
    });
    expect(screen.getAllByText('burst 1')).toHaveLength(1);
    expect(screen.getAllByText('burst 2')).toHaveLength(1);
    expect(screen.getAllByText('selected')).toHaveLength(1);
  });

  test('should leave the same-timestamp handling off when the timestamp does not repeat', async () => {
    // Only one row at this timestamp in the original result, so none of the widening or
    // page-growing should happen: one request per direction, at the plain page size.
    const selected = dataFrameToLogsModel([burstFrame([[BURST_MS, 'the only row']], 'anchor')]).rows[0];
    const newer: BurstRow[] = Array.from({ length: PAGE_SIZE }, (_, i) => [BURST_MS + i + 1, `newer ${i}`]);
    const older: BurstRow[] = Array.from({ length: PAGE_SIZE }, (_, i) => [BURST_MS - i - 1, `older ${i}`]);
    const getRowContext = jest
      .fn()
      .mockImplementation(async (_, options) =>
        options.direction === LogRowContextQueryDirection.Forward
          ? { data: [burstFrame(newer, 'ctx-fwd')] }
          : { data: [burstFrame(older, 'ctx-bwd')] }
      );

    render(
      <LogLineContext
        log={selected}
        open={true}
        onClose={() => {}}
        getRowContext={getRowContext}
        timeZone={timeZone}
        sortOrder={LogsSortOrder.Descending}
      />
    );

    await waitFor(() => expect(getRowContext).toHaveBeenCalledTimes(2));
    for (const [requestRow, options] of getRowContext.mock.calls) {
      expect(options.limit).toBe(PAGE_SIZE);
      expect(requestRow.timeEpochNs).toBe(`${BURST_MS}000000`);
    }
  });

  test('should split rows sharing the timestamp the way the original result ordered them', async () => {
    // The selected row sits between two rows sharing its timestamp in the original result.
    const original = burstFrame(
      [
        [BURST_MS, 'above in the original'],
        [BURST_MS, 'the selected row'],
        [BURST_MS, 'below in the original'],
      ],
      'anchor'
    );
    const selected = dataFrameToLogsModel([original]).rows[1];
    expect(selected.entry).toBe('the selected row');

    // The forward request returns the whole burst, as a data source would.
    const getRowContext = jest.fn().mockImplementation(async (_, options) =>
      options.direction === LogRowContextQueryDirection.Forward
        ? {
            data: [
              burstFrame(
                [
                  [BURST_MS, 'below in the original'],
                  [BURST_MS, 'above in the original'],
                ],
                'ctx-fwd'
              ),
            ],
          }
        : { data: [burstFrame([[BURST_MS - 1, 'before the burst']], 'ctx-bwd')] }
    );

    render(
      <LogLineContext
        log={selected}
        open={true}
        onClose={() => {}}
        getRowContext={getRowContext}
        timeZone={timeZone}
        sortOrder={LogsSortOrder.Descending}
      />
    );

    await waitFor(() => expect(screen.getByText('above in the original')).toBeInTheDocument());

    const above = screen.getByText('above in the original');
    const below = screen.getByText('below in the original');
    // The selected line is also shown in the modal header, so take its last occurrence: the
    // list renders after the header. The assertion is that it sits between the two siblings,
    // which only holds if they were split rather than both attached to the fetching side.
    const selectedInList = screen.getAllByText('the selected row').at(-1)!;
    const isFollowedBy = (a: Element, b: Element) =>
      Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

    expect(isFollowedBy(above, selectedInList)).toBe(true);
    expect(isFollowedBy(selectedInList, below)).toBe(true);
  });

  test('should not report the end of the logs when a response only fed the opposite side', async () => {
    const original = burstFrame(
      [
        [BURST_MS, 'sibling before'],
        [BURST_MS, 'the selected row'],
        [BURST_MS, 'sibling after'],
      ],
      'anchor'
    );
    const selected = dataFrameToLogsModel([original]).rows[1];
    // Descending, so 'above' issues the forward request. It returns only the sibling the
    // original result placed after the selected row, so every row it brings is assigned below
    // and the above side gains nothing -- which is not the same as running out of logs.
    const getRowContext = jest
      .fn()
      .mockImplementation(async (_, options) =>
        options.direction === LogRowContextQueryDirection.Forward
          ? { data: [burstFrame([[BURST_MS, 'sibling after']], 'ctx-fwd')] }
          : { data: [burstFrame([[BURST_MS - 1, 'older row']], 'ctx-bwd')] }
      );

    render(
      <LogLineContext
        log={selected}
        open={true}
        onClose={() => {}}
        getRowContext={getRowContext}
        timeZone={timeZone}
        sortOrder={LogsSortOrder.Descending}
      />
    );

    await waitFor(() => expect(screen.getByText('sibling after')).toBeInTheDocument());
    expect(screen.queryByText('No more logs available.')).not.toBeInTheDocument();
  });

  test('should ask the forward request from one nanosecond before the selected row', async () => {
    const selected = dataFrameToLogsModel([
      // The gate reads repeats off the original result, so the frame must contain a sibling.
      burstFrame(
        [
          [BURST_MS, 'selected'],
          [BURST_MS, 'a sibling in the original result'],
        ],
        'anchor'
      ),
    ]).rows[0];
    const getRowContext = jest.fn().mockResolvedValue({ data: [] });

    render(
      <LogLineContext
        log={selected}
        open={true}
        onClose={() => {}}
        getRowContext={getRowContext}
        timeZone={timeZone}
        sortOrder={LogsSortOrder.Descending}
      />
    );

    await waitFor(() => expect(getRowContext).toHaveBeenCalledTimes(2));
    const rowFor = (direction: LogRowContextQueryDirection) =>
      getRowContext.mock.calls.find(([, options]) => options.direction === direction)?.[0];

    // Forward ranges exclude the reference nanosecond, hiding every row sharing it.
    // Values are spelled out because epoch nanoseconds exceed Number.MAX_SAFE_INTEGER.
    expect(`${BURST_MS}000000`).toBe('1700000000000000000');
    expect(rowFor(LogRowContextQueryDirection.Forward).timeEpochNs).toBe('1699999999999999999');
    expect(rowFor(LogRowContextQueryDirection.Backward).timeEpochNs).toBe('1700000000000000000');
  });

  test('should request more logs when a full page is entirely one timestamp', async () => {
    const selected = dataFrameToLogsModel([
      // The gate reads repeats off the original result, so the frame must contain a sibling.
      burstFrame(
        [
          [BURST_MS, 'selected'],
          [BURST_MS, 'a sibling in the original result'],
        ],
        'anchor'
      ),
    ]).rows[0];
    // The page is full and entirely on the selected row's timestamp, so a bigger request is the
    // only way out even though this page did bring new rows.
    const insideBurst: BurstRow[] = Array.from({ length: PAGE_SIZE }, (_, i) => [BURST_MS, `burst ${i}`]);
    const pastBurst: BurstRow[] = [[BURST_MS + 1, 'after the burst']];
    const getRowContext = jest.fn().mockImplementation(async (_, options) => {
      if (options.direction === LogRowContextQueryDirection.Backward) {
        return { data: [burstFrame([[BURST_MS - 1, 'before the burst']], 'context-backward')] };
      }
      return {
        data: [
          burstFrame(
            options.limit > PAGE_SIZE ? [...insideBurst, ...pastBurst] : insideBurst,
            `context-forward-${options.limit}`
          ),
        ],
      };
    });

    render(
      <LogLineContext
        log={selected}
        open={true}
        onClose={() => {}}
        getRowContext={getRowContext}
        timeZone={timeZone}
        sortOrder={LogsSortOrder.Descending}
      />
    );

    await waitFor(() => {
      expect(getRowContext).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ limit: PAGE_SIZE * 2, direction: LogRowContextQueryDirection.Forward })
      );
    });
    await waitFor(() => {
      expect(screen.getAllByText(/^burst \d+$/).length).toBeGreaterThan(0);
    });
  });

  test('should request more logs when a full page holds nothing new', async () => {
    const selected = dataFrameToLogsModel([
      // The gate reads repeats off the original result, so the frame must contain a sibling.
      burstFrame(
        [
          [BURST_MS, 'selected'],
          [BURST_MS, 'a sibling in the original result'],
        ],
        'anchor'
      ),
    ]).rows[0];
    // Data sources anchor the context query on a timestamp and cannot skip rows, so the
    // first page of a burst bigger than PAGE_SIZE only repeats the rows already displayed.
    const firstPage: BurstRow[] = Array.from({ length: PAGE_SIZE }, () => [BURST_MS, 'selected']);
    const secondPage: BurstRow[] = Array.from({ length: PAGE_SIZE }, (_, i) => [BURST_MS, `burst ${i}`]);
    const getRowContext = jest.fn().mockImplementation(async (_, options) => {
      if (options.direction === LogRowContextQueryDirection.Backward) {
        return { data: [burstFrame([[BURST_MS - 1, 'before the burst']], 'context-backward')] };
      }
      return {
        data: [
          burstFrame(
            options.limit > PAGE_SIZE ? [...firstPage, ...secondPage] : firstPage,
            `context-forward-${options.limit}`
          ),
        ],
      };
    });

    render(
      <LogLineContext
        log={selected}
        open={true}
        onClose={() => {}}
        getRowContext={getRowContext}
        timeZone={timeZone}
        sortOrder={LogsSortOrder.Descending}
      />
    );

    await waitFor(() => {
      expect(getRowContext).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ limit: PAGE_SIZE * 2, direction: LogRowContextQueryDirection.Forward })
      );
    });
    // Only the rows next to the selected one are rendered, so match any of the burst.
    await waitFor(() => {
      expect(screen.getAllByText(/^burst \d+$/).length).toBeGreaterThan(0);
    });
    expect(screen.queryByText('No more logs available.')).not.toBeInTheDocument();
  });

  test('Should highlight the same `foo123` searchwords', async () => {
    const dfBeforeNs = createDataFrame({
      fields: [
        {
          name: 'time',
          type: FieldType.time,
          values: [1, 1],
        },
        {
          name: 'message',
          type: FieldType.string,
          values: ['this contains foo123', 'this contains foo123'],
        },
        {
          name: 'tsNs',
          type: FieldType.string,
          values: ['1', '2'],
        },
      ],
    });
    const dfNowNs = createDataFrame({
      fields: [
        {
          name: 'time',
          type: FieldType.time,
          values: [1],
        },
        {
          name: 'message',
          type: FieldType.string,
          values: ['this contains foo123'],
        },
        {
          name: 'tsNs',
          type: FieldType.string,
          values: ['2'],
        },
      ],
    });
    const dfAfterNs = createDataFrame({
      fields: [
        {
          name: 'time',
          type: FieldType.time,
          values: [1, 1],
        },
        {
          name: 'message',
          type: FieldType.string,
          values: ['this contains foo123', 'this contains foo123'],
        },
        {
          name: 'tsNs',
          type: FieldType.string,
          values: ['2', '3'],
        },
      ],
    });

    let uniqueRefIdCounter = 1;
    const logs = dataFrameToLogsModel([dfNowNs]);
    const row = logs.rows[0];
    row.searchWords = ['foo123'];
    const getRowContext = jest.fn().mockImplementation(async (_, options) => {
      uniqueRefIdCounter += 1;
      const refId = `refid_${uniqueRefIdCounter}`;
      if (uniqueRefIdCounter === 2) {
        return {
          data: [
            {
              refId,
              ...dfBeforeNs,
            },
          ],
        };
      } else if (uniqueRefIdCounter === 3) {
        return {
          data: [
            {
              refId,
              ...dfAfterNs,
            },
          ],
        };
      }
      return { data: [] };
    });

    render(
      <LogLineContext
        log={row}
        open={true}
        onClose={() => {}}
        getRowContext={getRowContext}
        timeZone={timeZone}
        sortOrder={LogsSortOrder.Descending}
      />
    );

    // there need to be 3 lines with that message, all `foo123` should be highlighted
    await waitFor(() => {
      expect(screen.getAllByText('foo123')).toHaveLength(3);
      expect(screen.getAllByText('this contains')).toHaveLength(3);
    });
  });

  test('Should show a split view button', async () => {
    const getRowContextQuery = jest.fn().mockResolvedValue({ datasource: { uid: 'test-uid' } });

    render(
      <LogLineContext
        log={row}
        open={true}
        onClose={() => {}}
        getRowContext={getRowContext}
        getRowContextQuery={getRowContextQuery}
        timeZone={timeZone}
        sortOrder={LogsSortOrder.Descending}
      />
    );

    await waitFor(() =>
      expect(
        screen.getByRole('button', {
          name: /open in split view/i,
        })
      ).toBeInTheDocument()
    );
  });

  test('Should not show a split view button', async () => {
    render(
      <LogLineContext
        log={row}
        open={true}
        onClose={() => {}}
        getRowContext={getRowContext}
        timeZone={timeZone}
        sortOrder={LogsSortOrder.Descending}
      />
    );

    await waitFor(() => {
      expect(
        screen.queryByRole('button', {
          name: /open in split view/i,
        })
      ).not.toBeInTheDocument();
    });
  });

  test('Should call getRowContextQuery', async () => {
    const getRowContextQuery = jest.fn().mockResolvedValue({ datasource: { uid: 'test-uid' } });
    render(
      <LogLineContext
        log={row}
        open={true}
        onClose={() => {}}
        getRowContext={getRowContext}
        getRowContextQuery={getRowContextQuery}
        timeZone={timeZone}
        sortOrder={LogsSortOrder.Descending}
      />
    );

    await waitFor(() => expect(getRowContextQuery).toHaveBeenCalledTimes(1));
  });

  test('Should close modal', async () => {
    const getRowContextQuery = jest.fn().mockResolvedValue({ datasource: { uid: 'test-uid' } });
    const onClose = jest.fn();
    render(
      <LogLineContext
        log={row}
        open={true}
        onClose={onClose}
        getRowContext={getRowContext}
        getRowContextQuery={getRowContextQuery}
        timeZone={timeZone}
        sortOrder={LogsSortOrder.Descending}
      />
    );

    const splitViewButton = await screen.findByRole('button', {
      name: /open in split view/i,
    });

    await userEvent.click(splitViewButton);

    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  test('Should create correct splitOpen', async () => {
    const queryObj = { datasource: { uid: 'test-uid' } };
    const getRowContextQuery = jest.fn().mockResolvedValue(queryObj);
    const onClose = jest.fn();

    render(
      <LogLineContext
        log={row}
        open={true}
        onClose={onClose}
        getRowContext={getRowContext}
        getRowContextQuery={getRowContextQuery}
        timeZone={timeZone}
        sortOrder={LogsSortOrder.Descending}
      />
    );

    const splitViewButton = await screen.findByRole('button', {
      name: /open in split view/i,
    });

    await userEvent.click(splitViewButton);

    await waitFor(() =>
      expect(splitOpen).toHaveBeenCalledWith(
        expect.objectContaining({
          queries: [queryObj],
          panelsState: {
            logs: {
              id: row.uid,
            },
          },
        })
      )
    );
  });

  test('Should dispatch splitOpen', async () => {
    const getRowContextQuery = jest.fn().mockResolvedValue({ datasource: { uid: 'test-uid' } });
    const onClose = jest.fn();

    render(
      <LogLineContext
        log={row}
        open={true}
        onClose={onClose}
        getRowContext={getRowContext}
        getRowContextQuery={getRowContextQuery}
        timeZone={timeZone}
        sortOrder={LogsSortOrder.Descending}
      />
    );

    const splitViewButton = await screen.findByRole('button', {
      name: /open in split view/i,
    });

    await userEvent.click(splitViewButton);

    await waitFor(() => expect(dispatchMock).toHaveBeenCalledWith(splitOpenSym));
  });

  test('Allows to change the time window surrounding the log', async () => {
    row.datasourceType = 'loki';

    render(
      <LogLineContext
        log={row}
        open={true}
        onClose={() => {}}
        getRowContext={getRowContext}
        timeZone={timeZone}
        sortOrder={LogsSortOrder.Descending}
      />
    );
    await waitFor(() =>
      expect(getRowContext).toHaveBeenCalledWith(expect.anything(), {
        limit: PAGE_SIZE,
        direction: LogRowContextQueryDirection.Forward,
        timeWindowMs: DEFAULT_TIME_WINDOW,
      })
    );
    expect(getRowContext).toHaveBeenCalledWith(expect.anything(), {
      limit: PAGE_SIZE,
      direction: LogRowContextQueryDirection.Backward,
      timeWindowMs: DEFAULT_TIME_WINDOW,
    });
  });

  test('Should show and clear displayed fields', async () => {
    const displayedFields = ['level', 'label'];

    render(
      <LogLineContext
        log={row}
        open={true}
        onClose={() => {}}
        getRowContext={getRowContext}
        timeZone={timeZone}
        sortOrder={LogsSortOrder.Descending}
        displayedFields={displayedFields}
      />
    );

    expect(screen.getByText('Log context')).toBeInTheDocument();
    expect(screen.queryByText('foo123')).not.toBeInTheDocument();

    const showOriginalLogsButton = screen.getByRole('button', {
      name: /show original logs/i,
    });

    expect(showOriginalLogsButton).toBeInTheDocument();

    await userEvent.click(showOriginalLogsButton);

    expect(
      screen.queryByRole('button', {
        name: /show original logs/i,
      })
    ).not.toBeInTheDocument();
    expect(screen.getAllByText('foo123')).toHaveLength(3);
  });

  test('Should hide "Show original logs" button when there are no displayed fields', async () => {
    render(
      <LogLineContext
        log={row}
        open={true}
        onClose={() => {}}
        getRowContext={getRowContext}
        timeZone={timeZone}
        sortOrder={LogsSortOrder.Descending}
        displayedFields={[]}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Log context')).toBeInTheDocument();
    });

    expect(
      screen.queryByRole('button', {
        name: /show original logs/i,
      })
    ).not.toBeInTheDocument();
  });

  test('Should show "Show original logs" button when displayed fields are provided', async () => {
    const displayedFields = ['level', 'label'];

    render(
      <LogLineContext
        log={row}
        open={true}
        onClose={() => {}}
        getRowContext={getRowContext}
        timeZone={timeZone}
        sortOrder={LogsSortOrder.Descending}
        displayedFields={displayedFields}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Log context')).toBeInTheDocument();
    });

    // Button should be visible when displayedFields are provided and differ from defaultDisplayedFields
    expect(
      screen.getByRole('button', {
        name: /show original logs/i,
      })
    ).toBeInTheDocument();
  });

  describe('Default displayed fields', () => {
    beforeEach(() => {
      setBooleanFlags({ otelLogsFormatting: true });
      jest
        .mocked(getDisplayedFieldsForLogs)
        .mockReturnValue([LOG_LINE_BODY_FIELD_NAME, OTEL_LOG_LINE_ATTRIBUTES_FIELD_NAME]);
    });

    test('Should show "Show original logs" button when displayed fields are different than the default fields', async () => {
      const displayedFields = ['level', 'label'];

      render(
        <LogLineContext
          log={row}
          open={true}
          onClose={() => {}}
          getRowContext={getRowContext}
          timeZone={timeZone}
          sortOrder={LogsSortOrder.Descending}
          displayedFields={displayedFields}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Log context')).toBeInTheDocument();
      });

      expect(
        screen.getByRole('button', {
          name: /show original logs/i,
        })
      ).toBeInTheDocument();
    });

    test('Should not show "Show original logs" button when displayed fields match the default fields', async () => {
      const displayedFields = [LOG_LINE_BODY_FIELD_NAME, OTEL_LOG_LINE_ATTRIBUTES_FIELD_NAME];

      render(
        <LogLineContext
          log={row}
          open={true}
          onClose={() => {}}
          getRowContext={getRowContext}
          timeZone={timeZone}
          sortOrder={LogsSortOrder.Descending}
          displayedFields={displayedFields}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Log context')).toBeInTheDocument();
      });

      expect(
        screen.queryByRole('button', {
          name: /show original logs/i,
        })
      ).not.toBeInTheDocument();
    });
  });

  test('uses otelLogsFormatting flag when building reference log model', async () => {
    setBooleanFlags({ otelLogsFormatting: true });
    jest.mocked(identifyOTelLanguage).mockReturnValue('go');
    jest.mocked(getOtelAttributesField).mockReturnValue('foo=bar');

    const otelLog = {
      ...row,
      labels: {
        ...row.labels,
        severity_number: '9',
        foo: 'bar',
      },
      entry: 'otel test log',
    };

    render(
      <LogLineContext
        log={otelLog}
        open={true}
        onClose={() => {}}
        getRowContext={getRowContext}
        timeZone={timeZone}
        sortOrder={LogsSortOrder.Descending}
      />
    );

    await waitFor(() => expect(getOtelAttributesField).toHaveBeenCalled());
  });
});

describe('combineLoadingStates', () => {
  test('reports in flight while either request is Loading or Streaming', () => {
    expect(combineLoadingStates(LoadingState.Loading, LoadingState.Done)).toBe(LoadingState.Loading);
    expect(combineLoadingStates(LoadingState.NotStarted, LoadingState.Loading)).toBe(LoadingState.Loading);
    // Streaming must count as in flight (preserved), not be mistaken for settled.
    expect(combineLoadingStates(LoadingState.Streaming, LoadingState.Done)).toBe(LoadingState.Streaming);
    expect(combineLoadingStates(LoadingState.Loading, LoadingState.Streaming)).toBe(LoadingState.Streaming);
  });

  test('reports Error when a settled request errored', () => {
    expect(combineLoadingStates(LoadingState.Error, LoadingState.Done)).toBe(LoadingState.Error);
    expect(combineLoadingStates(LoadingState.Done, LoadingState.Error)).toBe(LoadingState.Error);
    // In flight takes precedence over a sibling error (still not settled).
    expect(combineLoadingStates(LoadingState.Loading, LoadingState.Error)).toBe(LoadingState.Loading);
  });

  test('reports Done when nothing is in flight or errored', () => {
    expect(combineLoadingStates(LoadingState.Done, LoadingState.Done)).toBe(LoadingState.Done);
    expect(combineLoadingStates(LoadingState.NotStarted, LoadingState.NotStarted)).toBe(LoadingState.Done);
  });
});
