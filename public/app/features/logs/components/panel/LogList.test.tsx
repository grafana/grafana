import { render, screen } from '@testing-library/react';

import { CoreApp, getDefaultTimeRange, LogRowModel, LogsDedupStrategy, LogsSortOrder } from '@grafana/data';

import { createLogRow } from '../__mocks__/logRow';

import { LogList } from './LogList';

const logs: LogRowModel[] = [createLogRow({ uid: '1' }), createLogRow({ uid: '2' })];

describe('LogList', () => {
  test('Renders a list of logs without ', async () => {
    const containerElement = document.createElement('div');
    render(
      <LogList
        app={CoreApp.Explore}
        containerElement={containerElement}
        dedupStrategy={LogsDedupStrategy.none}
        displayedFields={[]}
        logs={logs}
        showControls={false}
        showTime={false}
        sortOrder={LogsSortOrder.Descending}
        timeRange={getDefaultTimeRange()}
        timeZone={'browser'}
        wrapLogMessage={false}
      />
    );
    expect(screen.getByText('log message 1')).toBeInTheDocument();
    expect(screen.getByText('log message 2')).toBeInTheDocument();
    expect(screen.queryByLabelText('Scroll to bottom')).not.toBeInTheDocument();
  });

  test('Renders a list of logs with controls', async () => {
    const containerElement = document.createElement('div');
    render(
      <LogList
        app={CoreApp.Explore}
        containerElement={containerElement}
        dedupStrategy={LogsDedupStrategy.none}
        displayedFields={[]}
        logs={logs}
        showControls={true}
        showTime={false}
        sortOrder={LogsSortOrder.Descending}
        timeRange={getDefaultTimeRange()}
        timeZone={'browser'}
        wrapLogMessage={false}
      />
    );
    expect(screen.getByText('log message 1')).toBeInTheDocument();
    expect(screen.getByText('log message 2')).toBeInTheDocument();
    expect(screen.getByLabelText('Scroll to bottom')).toBeInTheDocument();
  });
});
