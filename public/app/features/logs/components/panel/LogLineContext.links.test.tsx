import { render, waitFor } from 'test/test-utils';

import { createDataFrame, FieldType, LogsSortOrder } from '@grafana/data';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { type GetFieldLinksFn } from 'app/plugins/panel/logs/types';

import { dataFrameToLogsModel } from '../../logsModel';

import { LogLineContext } from './LogLineContext';
import { LogList } from './LogList';

// Render LogList as a stub so we can inspect the props LogLineContext forwards to it
// without depending on virtualized rendering of log lines.
jest.mock('./LogList', () => ({
  ...jest.requireActual('./LogList'),
  LogList: jest.fn(() => <div>LogList</div>),
}));

jest.mock('@grafana/assistant', () => ({
  ...jest.requireActual('@grafana/assistant'),
  useAssistant: jest.fn().mockReturnValue({
    isLoading: false,
    isAvailable: true,
    openAssistant: jest.fn(),
  }),
}));

const dispatchMock = jest.fn();
jest.mock('app/types/store', () => ({
  ...jest.requireActual('app/types/store'),
  useDispatch: () => dispatchMock,
}));

const dfNow = createDataFrame({
  fields: [
    { name: 'time', type: FieldType.time, values: ['2019-04-26T09:28:11.352440161Z'] },
    { name: 'message', type: FieldType.string, values: ['foo123'] },
  ],
});
const row = dataFrameToLogsModel([dfNow]).rows[0];
const timeZone = 'UTC';

const getRowContext = jest.fn().mockResolvedValue({ data: [] });

const getLastLogListProps = () => jest.mocked(LogList).mock.calls.at(-1)?.[0];

describe('LogLineContext data links', () => {
  beforeEach(() => {
    setTestFlags({});
    jest.mocked(LogList).mockClear();
  });

  test('forwards getFieldLinks to LogList so derived-field links can be resolved in the context modal', async () => {
    const getFieldLinks: GetFieldLinksFn = jest.fn(() => []);

    render(
      <LogLineContext
        log={row}
        open={true}
        onClose={() => {}}
        getRowContext={getRowContext}
        getFieldLinks={getFieldLinks}
        timeZone={timeZone}
        sortOrder={LogsSortOrder.Descending}
      />
    );

    await waitFor(() => expect(LogList).toHaveBeenCalled());
    expect(getLastLogListProps()?.getFieldLinks).toBe(getFieldLinks);
  });

  test('does not set getFieldLinks on LogList when none is provided', async () => {
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

    await waitFor(() => expect(LogList).toHaveBeenCalled());
    expect(getLastLogListProps()?.getFieldLinks).toBeUndefined();
  });
});
