import React from 'react';
import { render, screen } from '@testing-library/react';
import { dateTime, MutableDataFrame, DataFrame, FieldType } from '@grafana/data';
import { ExploreId } from 'app/types/explore';
import { dataFrameToLogsModel } from 'app/core/logs_model';
import { LogsContainerProps, LogsContainer } from './LogsContainer';

const setup = (propOverrides?: object) => {
  const props: LogsContainerProps = {
    exploreId: ExploreId.left,
    width: 500,
    syncedTimes: false,
    loading: false,
    splitOpen: jest.fn(),
    onStartScanning: jest.fn(),
    onStopScanning: jest.fn(),
    updateTimeRange: jest.fn(),
    logsResult: null,
    scanning: false,
    timeZone: 'utc',
    datasourceInstance: null,
    isLive: false,
    isPaused: false,
    logsHighlighterExpressions: [],
    absoluteRange: { from: 1546297200000, to: 1546383600000 },
    range: { from: dateTime('2019-01-01'), to: dateTime('2019-01-02'), raw: { from: 'now-1d', to: 'now' } },
    ...propOverrides,
  };

  return render(<LogsContainer {...props} />);
};

describe('LogsNavigation', () => {
  it('should render empty div if null logsResult', () => {
    const { container } = setup();
    expect(container.firstChild).toBeNull();
  });
  it('should render "No logs found" if empty logs model passed', () => {
    const emptyLogsModel: any = {
      hasUniqueLabels: false,
      rows: [],
      meta: [],
      series: [],
    };
    setup({ logsResult: emptyLogsModel });
    expect(screen.getByText(/no logs found/i)).toBeInTheDocument();
  });
  it('should render logs when logsModel containes logs', () => {
    const logsModel = dataFrameToLogsModel(testSeries, 1, 'utc');
    setup({ logsResult: logsModel });
    expect(screen.getAllByText('test_log_entry1')).toHaveLength(1);
  });
});

const testSeries: DataFrame[] = [
  new MutableDataFrame({
    fields: [
      {
        name: 'time',
        type: FieldType.time,
        values: ['2019-04-26T09:28:11.352440161Z', '2019-04-26T14:42:50.991981292Z'],
      },
      {
        name: 'message',
        type: FieldType.string,
        values: ['test_log_entry1', 'test_log_entry2'],
        labels: {
          label1: 'value1',
          label2: 'value2',
        },
      },
      {
        name: 'id',
        type: FieldType.string,
        values: ['foo', 'bar'],
      },
    ],
    meta: {
      limit: 10,
    },
  }),
];
