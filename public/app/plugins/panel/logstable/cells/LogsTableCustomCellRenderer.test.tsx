import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DataFrame, DataFrameType, FieldType, toDataFrame } from '@grafana/data';
import { LOGS_DATAPLANE_BODY_NAME, LOGS_DATAPLANE_TIMESTAMP_NAME, parseLogsFrame } from 'app/features/logs/logsFrame';

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

const ViewLogLineLabelText = 'View log line';
const CopyLogLineLabelText = 'Copy link to log line';
const CellValueText = 'Value';

describe('LogsTableCustomCellRenderer', () => {
  it('should render without any options', () => {
    render(
      <LogsTableCustomCellRenderer
        supportsPermalink={true}
        logsFrame={testLogsFrame}
        showInspectLogLine={false}
        showCopyLogLink={false}
        cellProps={{
          field: testLogsDataFrame[0].fields[1],
          rowIndex: 0,
          frame: testLogsDataFrame[0],
          value: CellValueText,
        }}
      />
    );

    expect(screen.queryByLabelText(ViewLogLineLabelText)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(CopyLogLineLabelText)).not.toBeInTheDocument();
    expect(screen.getByText(CellValueText)).toBeVisible();
  });

  describe('Inspect row', () => {
    it('should render', () => {
      render(
        <LogsTableCustomCellRenderer
          supportsPermalink={true}
          logsFrame={testLogsFrame}
          showInspectLogLine={true}
          showCopyLogLink={false}
          cellProps={{
            field: testLogsDataFrame[0].fields[1],
            rowIndex: 0,
            frame: testLogsDataFrame[0],
            value: CellValueText,
          }}
        />
      );

      expect(screen.queryByLabelText(ViewLogLineLabelText)).toBeInTheDocument();
      expect(screen.queryByLabelText(CopyLogLineLabelText)).not.toBeInTheDocument();
      expect(screen.getByText(CellValueText)).toBeVisible();
    });

    it('should show body text in inspect modal', async () => {
      render(
        <LogsTableCustomCellRenderer
          supportsPermalink={true}
          logsFrame={testLogsFrame}
          showInspectLogLine={true}
          showCopyLogLink={false}
          cellProps={{
            field: testLogsDataFrame[0].fields[1],
            rowIndex: 0,
            frame: testLogsDataFrame[0],
            value: CellValueText,
          }}
        />
      );
      expect(screen.queryByText('log 1')).not.toBeInTheDocument();
      await userEvent.click(screen.getByLabelText(ViewLogLineLabelText));
      await waitFor(() => expect(screen.queryByText('log 1')).toBeInTheDocument());
    });

    it('Should inspect body if body is not selected', async () => {
      // Remove body from data frame passed to the table (but it should be in the logs frame)
      const dataFrame: DataFrame = { ...testLogsDataFrame[0], fields: [testLogsDataFrame[0].fields[0]] };
      render(
        <LogsTableCustomCellRenderer
          supportsPermalink={true}
          logsFrame={testLogsFrame}
          showInspectLogLine={true}
          showCopyLogLink={false}
          cellProps={{
            field: dataFrame.fields[0],
            rowIndex: 0,
            frame: testLogsDataFrame[0],
            value: CellValueText,
          }}
        />
      );
      expect(screen.queryByText('log 1')).not.toBeInTheDocument();
      await userEvent.click(screen.getByLabelText(ViewLogLineLabelText));
      await waitFor(() => expect(screen.queryByText('log 1')).toBeInTheDocument());
    });
  });
  describe('Copy link to log line', () => {
    it('Should not show if permalink support is false', () => {
      render(
        <LogsTableCustomCellRenderer
          supportsPermalink={false}
          logsFrame={testLogsFrame}
          showInspectLogLine={false}
          showCopyLogLink={true}
          cellProps={{
            field: testLogsDataFrame[0].fields[1],
            rowIndex: 0,
            frame: testLogsDataFrame[0],
            value: CellValueText,
          }}
          buildLinkToLog={() => null}
        />
      );

      expect(screen.queryByLabelText(ViewLogLineLabelText)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(CopyLogLineLabelText)).not.toBeInTheDocument();
      expect(screen.getByText(CellValueText)).toBeVisible();
    });
    it('Should render', async () => {
      render(
        <LogsTableCustomCellRenderer
          supportsPermalink={true}
          logsFrame={testLogsFrame}
          showInspectLogLine={false}
          showCopyLogLink={true}
          cellProps={{
            field: testLogsDataFrame[0].fields[1],
            rowIndex: 0,
            frame: testLogsDataFrame[0],
            value: CellValueText,
          }}
          buildLinkToLog={() => null}
        />
      );

      expect(screen.queryByLabelText(ViewLogLineLabelText)).not.toBeInTheDocument();
      await waitFor(() => expect(screen.queryByLabelText(CopyLogLineLabelText)).toBeInTheDocument());

      expect(screen.getByText(CellValueText)).toBeVisible();
    });
  });
});
