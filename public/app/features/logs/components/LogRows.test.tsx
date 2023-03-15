import { act, render, screen } from '@testing-library/react';
import { range } from 'lodash';
import React from 'react';

import { LogRowModel, LogsDedupStrategy, LogsSortOrder } from '@grafana/data';

import { LogRows, PREVIEW_LIMIT } from './LogRows';
import { createLogRow } from './__mocks__/logRow';

describe('LogRows', () => {
  it('renders rows', () => {
    const rows: LogRowModel[] = [createLogRow({ uid: '1' }), createLogRow({ uid: '2' }), createLogRow({ uid: '3' })];
    render(
      <LogRows
        logRows={rows}
        dedupStrategy={LogsDedupStrategy.none}
        showLabels={false}
        showTime={false}
        wrapLogMessage={true}
        prettifyLogMessage={true}
        timeZone={'utc'}
        enableLogDetails={true}
        displayedFields={[]}
        onClickFilterLabel={() => {}}
        onClickFilterOutLabel={() => {}}
        onClickHideField={() => {}}
        onClickShowField={() => {}}
      />
    );

    expect(screen.queryAllByRole('row')).toHaveLength(3);
    expect(screen.queryAllByRole('row').at(0)).toHaveTextContent('log message 1');
    expect(screen.queryAllByRole('row').at(1)).toHaveTextContent('log message 2');
    expect(screen.queryAllByRole('row').at(2)).toHaveTextContent('log message 3');
  });

  it('renders rows only limited number of rows first', () => {
    const rows: LogRowModel[] = [createLogRow({ uid: '1' }), createLogRow({ uid: '2' }), createLogRow({ uid: '3' })];
    jest.useFakeTimers();
    const { rerender } = render(
      <LogRows
        logRows={rows}
        dedupStrategy={LogsDedupStrategy.none}
        showLabels={false}
        showTime={false}
        wrapLogMessage={true}
        prettifyLogMessage={true}
        timeZone={'utc'}
        previewLimit={1}
        enableLogDetails={true}
      />
    );

    // There is an extra row with the rows that are rendering
    expect(screen.queryAllByRole('row')).toHaveLength(2);
    expect(screen.queryAllByRole('row').at(0)).toHaveTextContent('log message 1');

    act(() => {
      jest.runAllTimers();
    });
    rerender(
      <LogRows
        logRows={rows}
        dedupStrategy={LogsDedupStrategy.none}
        showLabels={false}
        showTime={false}
        wrapLogMessage={true}
        prettifyLogMessage={true}
        timeZone={'utc'}
        previewLimit={1}
        enableLogDetails={true}
        displayedFields={[]}
        onClickFilterLabel={() => {}}
        onClickFilterOutLabel={() => {}}
        onClickHideField={() => {}}
        onClickShowField={() => {}}
      />
    );

    expect(screen.queryAllByRole('row')).toHaveLength(3);
    expect(screen.queryAllByRole('row').at(0)).toHaveTextContent('log message 1');
    expect(screen.queryAllByRole('row').at(1)).toHaveTextContent('log message 2');
    expect(screen.queryAllByRole('row').at(2)).toHaveTextContent('log message 3');

    jest.useRealTimers();
  });

  it('renders deduped rows if supplied', () => {
    const rows: LogRowModel[] = [createLogRow({ uid: '1' }), createLogRow({ uid: '2' }), createLogRow({ uid: '3' })];
    const dedupedRows: LogRowModel[] = [createLogRow({ uid: '4' }), createLogRow({ uid: '5' })];
    render(
      <LogRows
        logRows={rows}
        deduplicatedRows={dedupedRows}
        dedupStrategy={LogsDedupStrategy.none}
        showLabels={false}
        showTime={false}
        wrapLogMessage={true}
        prettifyLogMessage={true}
        timeZone={'utc'}
        enableLogDetails={true}
        displayedFields={[]}
        onClickFilterLabel={() => {}}
        onClickFilterOutLabel={() => {}}
        onClickHideField={() => {}}
        onClickShowField={() => {}}
      />
    );
    expect(screen.queryAllByRole('row')).toHaveLength(2);
    expect(screen.queryAllByRole('row').at(0)).toHaveTextContent('log message 4');
    expect(screen.queryAllByRole('row').at(1)).toHaveTextContent('log message 5');
  });

  it('renders with default preview limit', () => {
    // PREVIEW_LIMIT * 2 is there because otherwise we just render all rows
    const rows: LogRowModel[] = range(PREVIEW_LIMIT * 2 + 1).map((num) => createLogRow({ uid: num.toString() }));
    render(
      <LogRows
        logRows={rows}
        dedupStrategy={LogsDedupStrategy.none}
        showLabels={false}
        showTime={false}
        wrapLogMessage={true}
        prettifyLogMessage={true}
        timeZone={'utc'}
        enableLogDetails={true}
        displayedFields={[]}
        onClickFilterLabel={() => {}}
        onClickFilterOutLabel={() => {}}
        onClickHideField={() => {}}
        onClickShowField={() => {}}
      />
    );

    // There is an extra row with the rows that are rendering
    expect(screen.queryAllByRole('row')).toHaveLength(101);
  });

  it('renders asc ordered rows if order and function supplied', () => {
    const rows: LogRowModel[] = [
      createLogRow({ uid: '1', timeEpochMs: 1 }),
      createLogRow({ uid: '3', timeEpochMs: 3 }),
      createLogRow({ uid: '2', timeEpochMs: 2 }),
    ];
    render(
      <LogRows
        logRows={rows}
        dedupStrategy={LogsDedupStrategy.none}
        showLabels={false}
        showTime={false}
        wrapLogMessage={true}
        prettifyLogMessage={true}
        timeZone={'utc'}
        logsSortOrder={LogsSortOrder.Ascending}
        enableLogDetails={true}
        displayedFields={[]}
        onClickFilterLabel={() => {}}
        onClickFilterOutLabel={() => {}}
        onClickHideField={() => {}}
        onClickShowField={() => {}}
      />
    );

    expect(screen.queryAllByRole('row').at(0)).toHaveTextContent('log message 1');
    expect(screen.queryAllByRole('row').at(1)).toHaveTextContent('log message 2');
    expect(screen.queryAllByRole('row').at(2)).toHaveTextContent('log message 3');
  });
  it('renders desc ordered rows if order and function supplied', () => {
    const rows: LogRowModel[] = [
      createLogRow({ uid: '1', timeEpochMs: 1 }),
      createLogRow({ uid: '3', timeEpochMs: 3 }),
      createLogRow({ uid: '2', timeEpochMs: 2 }),
    ];
    render(
      <LogRows
        logRows={rows}
        dedupStrategy={LogsDedupStrategy.none}
        showLabels={false}
        showTime={false}
        wrapLogMessage={true}
        prettifyLogMessage={true}
        timeZone={'utc'}
        logsSortOrder={LogsSortOrder.Descending}
        enableLogDetails={true}
        displayedFields={[]}
        onClickFilterLabel={() => {}}
        onClickFilterOutLabel={() => {}}
        onClickHideField={() => {}}
        onClickShowField={() => {}}
      />
    );

    expect(screen.queryAllByRole('row').at(0)).toHaveTextContent('log message 3');
    expect(screen.queryAllByRole('row').at(1)).toHaveTextContent('log message 2');
    expect(screen.queryAllByRole('row').at(2)).toHaveTextContent('log message 1');
  });
});
