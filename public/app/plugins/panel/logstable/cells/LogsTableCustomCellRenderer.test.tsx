import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { type DataFrame, DataFrameType, FieldType, toDataFrame } from '@grafana/data';
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
    expect(screen.getByText(CellValueText)).toBeVisible();
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
