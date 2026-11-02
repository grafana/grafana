import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DataFrameType, FieldType, toDataFrame } from '@grafana/data';
import { createLogLine } from 'app/features/logs/components/mocks/logRow';
import { LOGS_DATAPLANE_BODY_NAME, LOGS_DATAPLANE_TIMESTAMP_NAME, parseLogsFrame } from 'app/features/logs/logsFrame';

import { LogDetailsContextProvider } from '../LogDetailsContext';

import { LogsTableCustomCellRenderer } from './LogsTableCustomCellRenderer';

const testLogsDataFrame = [
  toDataFrame({
    meta: {
      type: DataFrameType.LogLines,
    },
    fields: [
      { name: LOGS_DATAPLANE_TIMESTAMP_NAME, type: FieldType.time, values: [1, 2] },
      { name: LOGS_DATAPLANE_BODY_NAME, type: FieldType.string, values: ['log 1', 'log 2'] },
      {
        name: 'labels',
        type: FieldType.other,
        values: [
          { service: 'frontend', level: 'info' },
          { service: 'backend', level: 'error' },
        ],
      },
    ],
  }),
];
const testLogsFrame = parseLogsFrame(testLogsDataFrame[0]);

if (!testLogsFrame) {
  throw new Error('Failed to parse logs frame');
}

const ShowDetailsLabelText = 'Show details';
const CopyLogLineLabelText = 'Copy link to log line';
const CellValueText = 'Value';

describe('LogsTableCustomCellRenderer', () => {
  it('should render without any options', () => {
    render(
      <LogsTableCustomCellRenderer
        supportsPermalink={true}
        logsFrame={testLogsFrame}
        options={{
          enableLogDetails: false,
          showCopyLogLink: false,
        }}
        cellProps={{
          field: testLogsDataFrame[0].fields[1],
          rowIndex: 0,
          frame: testLogsDataFrame[0],
          value: CellValueText,
        }}
      />
    );

    expect(screen.queryByLabelText(CopyLogLineLabelText)).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Has a stack trace')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Has error fields')).not.toBeInTheDocument();
    expect(screen.getByText(CellValueText)).toBeVisible();
  });

  describe('Error attributes', () => {
    function renderRow(fields: Array<{ name: string; type: FieldType; values: unknown[] }>, rowIndex: number) {
      const frame = toDataFrame({
        meta: { type: DataFrameType.LogLines },
        fields,
      });
      const logsFrame = parseLogsFrame(frame);
      if (!logsFrame) {
        throw new Error('Failed to parse logs frame');
      }

      render(
        <LogsTableCustomCellRenderer
          supportsPermalink={true}
          logsFrame={logsFrame}
          options={{
            enableLogDetails: false,
            showCopyLogLink: false,
          }}
          cellProps={{
            field: frame.fields[1],
            rowIndex,
            frame,
            value: CellValueText,
          }}
        />
      );
    }

    it('says when the row contains a stack trace', async () => {
      const user = userEvent.setup();
      renderRow(
        [
          { name: LOGS_DATAPLANE_TIMESTAMP_NAME, type: FieldType.time, values: [1] },
          { name: LOGS_DATAPLANE_BODY_NAME, type: FieldType.string, values: ['log 1'] },
          { name: 'labels', type: FieldType.other, values: [{ 'exception.stacktrace': 'at main', app: 'api' }] },
        ],
        0
      );

      const icon = screen.getByLabelText('Has a stack trace');
      await user.hover(icon);
      expect(await screen.findByText('This log line contains a stack trace.')).toBeInTheDocument();
    });

    it.each([
      {
        source: 'label',
        key: 'error.type',
        fields: [
          { name: LOGS_DATAPLANE_TIMESTAMP_NAME, type: FieldType.time, values: [1] },
          { name: LOGS_DATAPLANE_BODY_NAME, type: FieldType.string, values: ['log 1'] },
          { name: 'labels', type: FieldType.other, values: [{ 'error.type': 'TimeoutError' }] },
        ],
      },
      {
        source: 'field',
        key: 'exception.type',
        fields: [
          { name: LOGS_DATAPLANE_TIMESTAMP_NAME, type: FieldType.time, values: [1] },
          { name: LOGS_DATAPLANE_BODY_NAME, type: FieldType.string, values: ['log 1'] },
          { name: 'labels', type: FieldType.other, values: [{}] },
          { name: 'exception.type', type: FieldType.string, values: ['TimeoutError'] },
        ],
      },
    ])('says the row has error fields when the only error attribute is $key on a $source', ({ fields }) => {
      renderRow(fields, 0);

      expect(screen.getByLabelText('Has error fields')).toBeInTheDocument();
      expect(screen.queryByLabelText('Has a stack trace')).not.toBeInTheDocument();
    });

    it('says when the row contains error fields and no stack trace', async () => {
      const user = userEvent.setup();
      renderRow(
        [
          { name: LOGS_DATAPLANE_TIMESTAMP_NAME, type: FieldType.time, values: [1] },
          { name: LOGS_DATAPLANE_BODY_NAME, type: FieldType.string, values: ['log 1'] },
          {
            name: 'labels',
            type: FieldType.other,
            values: [{ 'exception.message': 'failed', 'error.type': 'timeout' }],
          },
        ],
        0
      );

      const icon = screen.getByLabelText('Has error fields');
      expect(screen.queryByLabelText('Has a stack trace')).not.toBeInTheDocument();
      await user.hover(icon);
      expect(await screen.findByText('This log line contains error-related fields.')).toBeInTheDocument();
    });

    it('reads a stack trace from a dataframe field on that row', () => {
      renderRow(
        [
          { name: LOGS_DATAPLANE_TIMESTAMP_NAME, type: FieldType.time, values: [1, 2] },
          { name: LOGS_DATAPLANE_BODY_NAME, type: FieldType.string, values: ['log 1', 'log 2'] },
          { name: 'labels', type: FieldType.other, values: [{}, {}] },
          { name: 'exception.stacktrace', type: FieldType.string, values: [null, 'at main'] },
        ],
        1
      );

      expect(screen.getByLabelText('Has a stack trace')).toBeInTheDocument();
    });

    it('reserves icon space on rows without errors when another row has one', () => {
      renderRow(
        [
          { name: LOGS_DATAPLANE_TIMESTAMP_NAME, type: FieldType.time, values: [1, 2] },
          { name: LOGS_DATAPLANE_BODY_NAME, type: FieldType.string, values: ['log 1', 'log 2'] },
          {
            name: 'labels',
            type: FieldType.other,
            values: [{ 'exception.stacktrace': 'at main' }, { app: 'api' }],
          },
        ],
        1
      );

      expect(screen.queryByLabelText('Has a stack trace')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Has error fields')).not.toBeInTheDocument();
      expect(screen.getByText(CellValueText).previousElementSibling?.childElementCount).toBe(1);
    });

    it('does not mark a row whose error field is empty', () => {
      renderRow(
        [
          { name: LOGS_DATAPLANE_TIMESTAMP_NAME, type: FieldType.time, values: [1] },
          { name: LOGS_DATAPLANE_BODY_NAME, type: FieldType.string, values: ['log 1'] },
          { name: 'labels', type: FieldType.other, values: [{ tech_stack: 'react' }] },
          { name: 'error.message', type: FieldType.string, values: [null] },
        ],
        0
      );

      expect(screen.queryByLabelText('Has a stack trace')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Has error fields')).not.toBeInTheDocument();
      expect(screen.getByText(CellValueText).previousElementSibling?.childElementCount).toBe(0);
    });
  });

  describe('Show details', () => {
    it('should render', () => {
      const logs = [createLogLine()];
      render(
        <LogDetailsContextProvider enableLogDetails logs={logs}>
          <LogsTableCustomCellRenderer
            supportsPermalink={true}
            logsFrame={testLogsFrame}
            options={{
              enableLogDetails: true,
              showCopyLogLink: false,
            }}
            cellProps={{
              field: testLogsDataFrame[0].fields[1],
              rowIndex: 0,
              frame: testLogsDataFrame[0],
              value: CellValueText,
            }}
          />
        </LogDetailsContextProvider>
      );

      expect(screen.getByLabelText(ShowDetailsLabelText)).toBeInTheDocument();
    });
  });

  describe('Copy link to log line', () => {
    it('Should not show if permalink support is false', () => {
      render(
        <LogsTableCustomCellRenderer
          supportsPermalink={false}
          logsFrame={testLogsFrame}
          options={{
            enableLogDetails: false,
            showCopyLogLink: true,
          }}
          cellProps={{
            field: testLogsDataFrame[0].fields[1],
            rowIndex: 0,
            frame: testLogsDataFrame[0],
            value: CellValueText,
          }}
          buildLinkToLog={() => null}
        />
      );

      expect(screen.queryByLabelText(CopyLogLineLabelText)).not.toBeInTheDocument();
      expect(screen.getByText(CellValueText)).toBeVisible();
    });
    it('Should render', async () => {
      render(
        <LogsTableCustomCellRenderer
          supportsPermalink={true}
          logsFrame={testLogsFrame}
          options={{
            enableLogDetails: false,
            showCopyLogLink: true,
          }}
          cellProps={{
            field: testLogsDataFrame[0].fields[1],
            rowIndex: 0,
            frame: testLogsDataFrame[0],
            value: CellValueText,
          }}
          buildLinkToLog={() => null}
        />
      );

      await waitFor(() => expect(screen.queryByLabelText(CopyLogLineLabelText)).toBeInTheDocument());

      expect(screen.getByText(CellValueText)).toBeVisible();
    });
  });
});
