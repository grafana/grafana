import { render, screen, waitFor, userEvent } from 'test/test-utils';

import {
  createDataFrame,
  FieldType,
  LogRowContextQueryDirection,
  LogsSortOrder,
  SplitOpenOptions,
} from '@grafana/data';

import { dataFrameToLogsModel } from '../../logsModel';

import { DEFAULT_TIME_WINDOW, LogLineContext, PAGE_SIZE } from './LogLineContext';

jest.mock('@grafana/assistant', () => ({
  ...jest.requireActual('@grafana/assistant'),
  useAssistant: jest.fn(() => [true, jest.fn()]),
}));

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

const logs = dataFrameToLogsModel([dfNow]);
const row = logs.rows[0];

const timeZone = 'UTC';

describe('LogLineContext', () => {
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
    await waitFor(() => expect(getRowContext).toHaveBeenCalledWith(expect.anything(), {
      limit: PAGE_SIZE,
      direction: LogRowContextQueryDirection.Forward,
      timeWindowMs: DEFAULT_TIME_WINDOW,
    }));
    expect(getRowContext).toHaveBeenCalledWith(expect.anything(), {
      limit: PAGE_SIZE,
      direction: LogRowContextQueryDirection.Backward,
      timeWindowMs: DEFAULT_TIME_WINDOW,
    });
  });
});
