import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { LoadingState, LogLevel, LogRowModel, MutableDataFrame, toUtc, EventBusSrv } from '@grafana/data';

import { Logs } from './Logs';

describe('Logs', () => {
  const setup = (logs?: LogRowModel[]) => {
    const rows = [
      makeLog({ uid: '1', timeEpochMs: 1 }),
      makeLog({ uid: '2', timeEpochMs: 2 }),
      makeLog({ uid: '3', timeEpochMs: 3 }),
    ];

    return render(
      <Logs
        exploreId={'left'}
        splitOpen={() => undefined}
        logsVolumeEnabled={true}
        onSetLogsVolumeEnabled={() => null}
        onClickFilterLabel={() => null}
        onClickFilterOutLabel={() => null}
        logsVolumeData={undefined}
        loadLogsVolumeData={() => undefined}
        logRows={logs ?? rows}
        timeZone={'utc'}
        width={50}
        loading={false}
        loadingState={LoadingState.Done}
        absoluteRange={{
          from: toUtc('2019-01-01 10:00:00').valueOf(),
          to: toUtc('2019-01-01 16:00:00').valueOf(),
        }}
        addResultsToCache={() => {}}
        onChangeTime={() => {}}
        clearCache={() => {}}
        getFieldLinks={() => {
          return [];
        }}
        eventBus={new EventBusSrv()}
      />
    );
  };

  it('should render logs', () => {
    setup();
    const logsSection = screen.getByTestId('logRows');
    let logRows = logsSection.querySelectorAll('tr');
    expect(logRows.length).toBe(3);
    expect(logRows[0].textContent).toContain('log message 3');
    expect(logRows[2].textContent).toContain('log message 1');
  });

  it('should render no logs found', () => {
    setup([]);

    expect(screen.getByText(/no logs found\./i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: /scan for older logs/i,
      })
    ).toBeInTheDocument();
  });

  it('should render a load more button', () => {
    const scanningStarted = jest.fn();
    render(
      <Logs
        exploreId={'left'}
        splitOpen={() => undefined}
        logsVolumeEnabled={true}
        onSetLogsVolumeEnabled={() => null}
        onClickFilterLabel={() => null}
        onClickFilterOutLabel={() => null}
        logsVolumeData={undefined}
        loadLogsVolumeData={() => undefined}
        logRows={[]}
        onStartScanning={scanningStarted}
        timeZone={'utc'}
        width={50}
        loading={false}
        loadingState={LoadingState.Done}
        absoluteRange={{
          from: toUtc('2019-01-01 10:00:00').valueOf(),
          to: toUtc('2019-01-01 16:00:00').valueOf(),
        }}
        addResultsToCache={() => {}}
        onChangeTime={() => {}}
        clearCache={() => {}}
        getFieldLinks={() => {
          return [];
        }}
        eventBus={new EventBusSrv()}
      />
    );
    const button = screen.getByRole('button', {
      name: /scan for older logs/i,
    });
    button.click();
    expect(scanningStarted).toHaveBeenCalled();
  });

  it('should render a stop scanning button', () => {
    render(
      <Logs
        exploreId={'left'}
        splitOpen={() => undefined}
        logsVolumeEnabled={true}
        onSetLogsVolumeEnabled={() => null}
        onClickFilterLabel={() => null}
        onClickFilterOutLabel={() => null}
        logsVolumeData={undefined}
        loadLogsVolumeData={() => undefined}
        logRows={[]}
        scanning={true}
        timeZone={'utc'}
        width={50}
        loading={false}
        loadingState={LoadingState.Done}
        absoluteRange={{
          from: toUtc('2019-01-01 10:00:00').valueOf(),
          to: toUtc('2019-01-01 16:00:00').valueOf(),
        }}
        addResultsToCache={() => {}}
        onChangeTime={() => {}}
        clearCache={() => {}}
        getFieldLinks={() => {
          return [];
        }}
        eventBus={new EventBusSrv()}
      />
    );

    expect(
      screen.getByRole('button', {
        name: /stop scan/i,
      })
    ).toBeInTheDocument();
  });

  it('should render a stop scanning button', () => {
    const scanningStopped = jest.fn();

    render(
      <Logs
        exploreId={'left'}
        splitOpen={() => undefined}
        logsVolumeEnabled={true}
        onSetLogsVolumeEnabled={() => null}
        onClickFilterLabel={() => null}
        onClickFilterOutLabel={() => null}
        logsVolumeData={undefined}
        loadLogsVolumeData={() => undefined}
        logRows={[]}
        scanning={true}
        onStopScanning={scanningStopped}
        timeZone={'utc'}
        width={50}
        loading={false}
        loadingState={LoadingState.Done}
        absoluteRange={{
          from: toUtc('2019-01-01 10:00:00').valueOf(),
          to: toUtc('2019-01-01 16:00:00').valueOf(),
        }}
        addResultsToCache={() => {}}
        onChangeTime={() => {}}
        clearCache={() => {}}
        getFieldLinks={() => {
          return [];
        }}
        eventBus={new EventBusSrv()}
      />
    );

    const button = screen.getByRole('button', {
      name: /stop scan/i,
    });
    button.click();
    expect(scanningStopped).toHaveBeenCalled();
  });

  it('should flip the order', async () => {
    setup();
    const oldestFirstSelection = screen.getByLabelText('Oldest first');
    await userEvent.click(oldestFirstSelection);
    const logsSection = screen.getByTestId('logRows');
    let logRows = logsSection.querySelectorAll('tr');
    expect(logRows.length).toBe(3);
    expect(logRows[0].textContent).toContain('log message 1');
    expect(logRows[2].textContent).toContain('log message 3');
  });
});

const makeLog = (overrides: Partial<LogRowModel>): LogRowModel => {
  const uid = overrides.uid || '1';
  const entry = `log message ${uid}`;
  return {
    uid,
    entryFieldIndex: 0,
    rowIndex: 0,
    dataFrame: new MutableDataFrame(),
    logLevel: LogLevel.debug,
    entry,
    hasAnsi: false,
    hasUnescapedContent: false,
    labels: {},
    raw: entry,
    timeFromNow: '',
    timeEpochMs: 1,
    timeEpochNs: '1000000',
    timeLocal: '',
    timeUtc: '',
    ...overrides,
  };
};
