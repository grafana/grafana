import React from 'react';
import { range } from 'lodash';
import { LogRows, PREVIEW_LIMIT } from './LogRows';
import { mount } from 'enzyme';
import { LogLevel, LogRowModel, LogsDedupStrategy, MutableDataFrame, LogsSortOrder } from '@grafana/data';
import { LogRow } from './LogRow';

describe('LogRows', () => {
  it('renders rows', () => {
    const rows: LogRowModel[] = [makeLog({ uid: '1' }), makeLog({ uid: '2' }), makeLog({ uid: '3' })];
    const wrapper = mount(
      <LogRows
        logRows={rows}
        dedupStrategy={LogsDedupStrategy.none}
        highlighterExpressions={[]}
        showLabels={false}
        showTime={false}
        wrapLogMessage={true}
        timeZone={'utc'}
      />
    );

    expect(wrapper.find(LogRow).length).toBe(3);
    expect(wrapper.contains('log message 1')).toBeTruthy();
    expect(wrapper.contains('log message 2')).toBeTruthy();
    expect(wrapper.contains('log message 3')).toBeTruthy();
  });

  it('renders rows only limited number of rows first', () => {
    const rows: LogRowModel[] = [makeLog({ uid: '1' }), makeLog({ uid: '2' }), makeLog({ uid: '3' })];
    jest.useFakeTimers();
    const wrapper = mount(
      <LogRows
        logRows={rows}
        dedupStrategy={LogsDedupStrategy.none}
        highlighterExpressions={[]}
        showLabels={false}
        showTime={false}
        wrapLogMessage={true}
        timeZone={'utc'}
        previewLimit={1}
      />
    );

    expect(wrapper.find(LogRow).length).toBe(1);
    expect(wrapper.contains('log message 1')).toBeTruthy();
    jest.runAllTimers();
    wrapper.update();

    expect(wrapper.find(LogRow).length).toBe(3);
    expect(wrapper.contains('log message 1')).toBeTruthy();
    expect(wrapper.contains('log message 2')).toBeTruthy();
    expect(wrapper.contains('log message 3')).toBeTruthy();

    jest.useRealTimers();
  });

  it('renders deduped rows if supplied', () => {
    const rows: LogRowModel[] = [makeLog({ uid: '1' }), makeLog({ uid: '2' }), makeLog({ uid: '3' })];
    const dedupedRows: LogRowModel[] = [makeLog({ uid: '4' }), makeLog({ uid: '5' })];
    const wrapper = mount(
      <LogRows
        logRows={rows}
        deduplicatedRows={dedupedRows}
        dedupStrategy={LogsDedupStrategy.none}
        highlighterExpressions={[]}
        showLabels={false}
        showTime={false}
        wrapLogMessage={true}
        timeZone={'utc'}
      />
    );

    expect(wrapper.find(LogRow).length).toBe(2);
    expect(wrapper.contains('log message 4')).toBeTruthy();
    expect(wrapper.contains('log message 5')).toBeTruthy();
  });

  it('renders with default preview limit', () => {
    // PREVIEW_LIMIT * 2 is there because otherwise we just render all rows
    const rows: LogRowModel[] = range(PREVIEW_LIMIT * 2 + 1).map(num => makeLog({ uid: num.toString() }));
    const wrapper = mount(
      <LogRows
        logRows={rows}
        dedupStrategy={LogsDedupStrategy.none}
        highlighterExpressions={[]}
        showLabels={false}
        showTime={false}
        wrapLogMessage={true}
        timeZone={'utc'}
      />
    );

    expect(wrapper.find(LogRow).length).toBe(100);
  });

  it('renders asc ordered rows if order and function supplied', () => {
    const rows: LogRowModel[] = [
      makeLog({ uid: '1', timeEpochMs: 1 }),
      makeLog({ uid: '3', timeEpochMs: 3 }),
      makeLog({ uid: '2', timeEpochMs: 2 }),
    ];
    const wrapper = mount(
      <LogRows
        logRows={rows}
        dedupStrategy={LogsDedupStrategy.none}
        highlighterExpressions={[]}
        showLabels={false}
        showTime={false}
        wrapLogMessage={true}
        timeZone={'utc'}
        logsSortOrder={LogsSortOrder.Ascending}
      />
    );

    expect(
      wrapper
        .find(LogRow)
        .at(0)
        .text()
    ).toBe('log message 1');
    expect(
      wrapper
        .find(LogRow)
        .at(1)
        .text()
    ).toBe('log message 2');
    expect(
      wrapper
        .find(LogRow)
        .at(2)
        .text()
    ).toBe('log message 3');
  });
  it('renders desc ordered rows if order and function supplied', () => {
    const rows: LogRowModel[] = [
      makeLog({ uid: '1', timeEpochMs: 1 }),
      makeLog({ uid: '3', timeEpochMs: 3 }),
      makeLog({ uid: '2', timeEpochMs: 2 }),
    ];
    const wrapper = mount(
      <LogRows
        logRows={rows}
        dedupStrategy={LogsDedupStrategy.none}
        highlighterExpressions={[]}
        showLabels={false}
        showTime={false}
        wrapLogMessage={true}
        timeZone={'utc'}
        logsSortOrder={LogsSortOrder.Descending}
      />
    );

    expect(
      wrapper
        .find(LogRow)
        .at(0)
        .text()
    ).toBe('log message 3');
    expect(
      wrapper
        .find(LogRow)
        .at(1)
        .text()
    ).toBe('log message 2');
    expect(
      wrapper
        .find(LogRow)
        .at(2)
        .text()
    ).toBe('log message 1');
  });
});

const makeLog = (overrides: Partial<LogRowModel>): LogRowModel => {
  const uid = overrides.uid || '1';
  const timeEpochMs = overrides.timeEpochMs || 1;
  const entry = `log message ${uid}`;
  return {
    entryFieldIndex: 0,
    rowIndex: 0,
    // Does not need to be filled with current tests
    dataFrame: new MutableDataFrame(),
    uid,
    logLevel: LogLevel.debug,
    entry,
    hasAnsi: false,
    labels: {},
    raw: entry,
    timeFromNow: '',
    timeEpochMs,
    timeEpochNs: (timeEpochMs * 1000000).toString(),
    timeLocal: '',
    timeUtc: '',
    searchWords: [],
    ...overrides,
  };
};
