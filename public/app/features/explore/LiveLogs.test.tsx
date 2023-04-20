import { render, screen } from '@testing-library/react';
import React from 'react';

import { LogRowModel } from '@grafana/data';

import { LiveLogsWithTheme } from './LiveLogs';
import { makeLogs } from './__mocks__/makeLogs';

const setup = (rows: LogRowModel[]) =>
  render(
    <LiveLogsWithTheme
      logRows={rows}
      timeZone={'utc'}
      stopLive={() => {}}
      onPause={() => {}}
      onResume={() => {}}
      onClear={() => {}}
      clearedAtIndex={null}
      isPaused={true}
    />
  );

describe('LiveLogs', () => {
  it('renders logs', () => {
    const logRows = makeLogs(3);
    setup(logRows);

    expect(screen.getByRole('cell', { name: 'log message 1' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'log message 2' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'log message 3' })).toBeInTheDocument();
  });

  it('renders new logs only when not paused', () => {
    const logRows = makeLogs(6);
    const firstLogs = logRows.slice(0, 3);
    const secondLogs = logRows.slice(3, 6);
    const { rerender } = setup(firstLogs);

    rerender(
      <LiveLogsWithTheme
        logRows={secondLogs}
        timeZone={'utc'}
        stopLive={() => {}}
        onPause={() => {}}
        onClear={() => {}}
        clearedAtIndex={null}
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
        logRows={secondLogs}
        timeZone={'utc'}
        stopLive={() => {}}
        onPause={() => {}}
        onResume={() => {}}
        onClear={() => {}}
        clearedAtIndex={null}
        isPaused={false}
      />
    );

    expect(screen.getByRole('cell', { name: 'log message 4' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'log message 5' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'log message 6' })).toBeInTheDocument();
  });

  it('renders ansi logs', () => {
    const commonLog = makeLogs(1);
    const firstAnsiLog = makeLogs(1, { hasAnsi: true, raw: 'log message \u001B[31m2\u001B[0m', uid: '2' });
    const secondAnsiLog = makeLogs(1, { hasAnsi: true, raw: 'log message \u001B[33m3\u001B[0m', uid: '3' });
    const logRows = [...commonLog, ...firstAnsiLog, ...secondAnsiLog];

    setup(logRows);

    expect(screen.getByRole('cell', { name: 'log message 1' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'log message 2' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'log message 3' })).toBeInTheDocument();

    const logList = screen.getAllByTestId('ansiLogLine');
    expect(logList).toHaveLength(2);
    expect(logList[0]).toHaveAttribute('style', 'color: rgb(204, 0, 0);');
    expect(logList[1]).toHaveAttribute('style', 'color: rgb(204, 102, 0);');
  });
});
