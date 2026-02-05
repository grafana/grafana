import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DataFrameType, FieldType, toDataFrame } from '@grafana/data';
import { FIELD_SELECTOR_MIN_WIDTH } from 'app/features/logs/components/fieldSelector/FieldSelector';
import {
  LOGS_DATAPLANE_BODY_NAME,
  LOGS_DATAPLANE_TIMESTAMP_NAME,
  LogsFrame,
  parseLogsFrame,
} from 'app/features/logs/logsFrame';

import { LogsTableFields } from './LogsTableFields';

const height = 200;
const tableWidth = 200;
const fieldSelectorWidth = 80;
const onFieldSelectorWidthChange = jest.fn();
const setUp = (props?: Partial<React.ComponentProps<typeof LogsTableFields>>) => {
  const testLogsDataFrame = [
    toDataFrame({
      meta: {
        type: DataFrameType.LogLines,
      },
      fields: [
        { name: LOGS_DATAPLANE_TIMESTAMP_NAME, type: FieldType.time, values: [1, 2] },
        { name: LOGS_DATAPLANE_BODY_NAME, type: FieldType.string, values: ['log 1', 'log 2'] },
        { name: 'service', type: FieldType.string, values: ['service 1', 'service 2'] },
        { name: 'backend', type: FieldType.string, values: ['backend 1', null] },
      ],
    }),
  ];
  const logsFrame = parseLogsFrame(testLogsDataFrame[0]) as LogsFrame;

  return render(
    <LogsTableFields
      fieldSelectorWidth={fieldSelectorWidth}
      onFieldSelectorWidthChange={onFieldSelectorWidthChange}
      displayedFields={[]}
      onDisplayedFieldsChange={jest.fn()}
      dataFrame={testLogsDataFrame[0]}
      logsFrame={logsFrame}
      tableWidth={tableWidth}
      height={height}
      timeFieldName={LOGS_DATAPLANE_TIMESTAMP_NAME}
      bodyFieldName={LOGS_DATAPLANE_BODY_NAME}
      {...props}
    />
  );
};

describe('LogsTableFields', () => {
  it('Should render', () => {
    setUp();
    expect(screen.getByText('Selected fields')).toBeVisible();
    expect(screen.getByPlaceholderText(/search fields by name/i)).toBeVisible();

    // screen.logTestingPlaygroundURL();
    [LOGS_DATAPLANE_TIMESTAMP_NAME, LOGS_DATAPLANE_TIMESTAMP_NAME, 'service', 'backend'].forEach((label) => {
      expect(screen.getByRole('checkbox', { name: label })).toBeInTheDocument();
      expect(screen.getByText(label)).toBeVisible();
    });
  });

  it('Should collapse', async () => {
    setUp();
    expect(onFieldSelectorWidthChange).toBeCalledTimes(0);

    await userEvent.click(screen.getByRole('button', { name: /collapse sidebar/i }));
    expect(onFieldSelectorWidthChange).toBeCalledTimes(1);
    expect(onFieldSelectorWidthChange).toBeCalledWith(FIELD_SELECTOR_MIN_WIDTH);
  });
});
