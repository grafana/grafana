import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

import { LoadingState, LogLevel, LogRowModel, MutableDataFrame, toUtc, EventBusSrv } from '@grafana/data';
import { ExploreId } from 'app/types';

import { Logs } from './Logs';

describe('Logs', () => {
  const setup = (propOverrides?: object) => {
    const rows = [
      makeLog({ uid: '1', timeEpochMs: 1 }),
      makeLog({ uid: '2', timeEpochMs: 2 }),
      makeLog({ uid: '3', timeEpochMs: 3 }),
    ];

    return render(
      <Logs
        exploreId={ExploreId.left}
        splitOpen={() => undefined}
        logsVolumeEnabled={true}
        onSetLogsVolumeEnabled={() => null}
        logsVolumeData={undefined}
        loadLogsVolumeData={() => undefined}
        logRows={rows}
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

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should render logs', () => {
    setup();
    const logsSection = screen.getByTestId('logRows');
    let logRows = logsSection.querySelectorAll('tr');
    expect(logRows.length).toBe(3);
    expect(logRows[0].textContent).toContain('log message 3');
    expect(logRows[2].textContent).toContain('log message 1');
  });

  it('should flip the order', () => {
    setup();
    const oldestFirstSelection = screen.getByLabelText('Oldest first');
    fireEvent.click(oldestFirstSelection);
    jest.advanceTimersByTime(1000);
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
