import { render, screen } from '@testing-library/react';
import React from 'react';

import { LogLevel, LogRowModel, MutableDataFrame } from '@grafana/data';

import { LiveLogsWithTheme } from './LiveLogs';

const setup = (rows: LogRowModel[]) =>
  render(
    <LiveLogsWithTheme
      logRows={rows}
      timeZone={'utc'}
      stopLive={() => {}}
      onPause={() => {}}
      onResume={() => {}}
      isPaused={true}
    />
  );

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

describe('LiveLogs', () => {
  it('renders logs', () => {
    setup([makeLog({ uid: '1' }), makeLog({ uid: '2' }), makeLog({ uid: '3' })]);

    expect(screen.getByRole('cell', { name: 'log message 1' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'log message 2' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'log message 3' })).toBeInTheDocument();
  });

  it('renders new logs only when not paused', () => {
    const { rerender } = setup([makeLog({ uid: '1' }), makeLog({ uid: '2' }), makeLog({ uid: '3' })]);

    rerender(
      <LiveLogsWithTheme
        logRows={[makeLog({ uid: '4' }), makeLog({ uid: '5' }), makeLog({ uid: '6' })]}
        timeZone={'utc'}
        stopLive={() => {}}
        onPause={() => {}}
        onResume={() => {}}
        isPaused={true}
      />
    );

    expect(screen.getByRole('cell', { name: 'log message 1' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'log message 2' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'log message 3' })).toBeInTheDocument();
    expect(screen.queryByRole('cell', { name: 'log message 4' })).not.toBeInTheDocument();
    expect(screen.queryByRole('cell', { name: 'log message 5' })).not.toBeInTheDocument();
    expect(screen.queryByRole('cell', { name: 'log message 6' })).not.toBeInTheDocument();

    rerender(
      <LiveLogsWithTheme
        logRows={[makeLog({ uid: '4' }), makeLog({ uid: '5' }), makeLog({ uid: '6' })]}
        timeZone={'utc'}
        stopLive={() => {}}
        onPause={() => {}}
        onResume={() => {}}
        isPaused={false}
      />
    );

    expect(screen.getByRole('cell', { name: 'log message 4' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'log message 5' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'log message 6' })).toBeInTheDocument();
  });

  it('renders ansi logs', () => {
    setup([
      makeLog({ uid: '1' }),
      makeLog({ hasAnsi: true, raw: 'log message \u001B[31m2\u001B[0m', uid: '2' }),
      makeLog({ hasAnsi: true, raw: 'log message \u001B[33m3\u001B[0m', uid: '3' }),
    ]);

    expect(screen.getByRole('cell', { name: 'log message 1' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'log message 2' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'log message 3' })).toBeInTheDocument();

    const logList = screen.getAllByTestId('ansiLogLine');
    expect(logList).toHaveLength(2);
    expect(logList[0]).toHaveAttribute('style', 'color: rgb(204, 0, 0);');
    expect(logList[1]).toHaveAttribute('style', 'color: rgb(204, 102, 0);');
  });
});
