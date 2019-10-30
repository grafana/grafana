import React from 'react';
import { LogRows } from './LogRows';
import { mount } from 'enzyme';
import { LogLevel, LogRowModel, LogsDedupStrategy } from '@grafana/data';
import { LogRow } from './LogRow';

describe('LogRows', () => {
  it('renders rows', () => {
    jest.useFakeTimers();
    const rows: LogRowModel[] = [makeLog({ uid: '1' }), makeLog({ uid: '2' }), makeLog({ uid: '3' })];
    const wrapper = mount(
      <LogRows
        hasUniqueLabels={false}
        dedupStrategy={LogsDedupStrategy.none}
        logRows={rows}
        highlighterExpressions={[]}
        showTime={false}
        showLabels={false}
        timeZone={'utc'}
      />
    );

    jest.runAllTimers();
    wrapper.update();

    expect(wrapper.find(LogRow).length).toBe(3);
    expect(wrapper.contains('log message 1')).toBeTruthy();
    expect(wrapper.contains('log message 2')).toBeTruthy();
    expect(wrapper.contains('log message 3')).toBeTruthy();
    jest.useRealTimers();
  });

  it('renders deduped rows if supplied', () => {
    jest.useFakeTimers();
    const rows: LogRowModel[] = [makeLog({ uid: '1' }), makeLog({ uid: '2' }), makeLog({ uid: '3' })];
    const dedupedRows: LogRowModel[] = [makeLog({ uid: '4' }), makeLog({ uid: '5' })];
    const wrapper = mount(
      <LogRows
        hasUniqueLabels={false}
        dedupStrategy={LogsDedupStrategy.none}
        deduplicatedRows={dedupedRows}
        logRows={rows}
        highlighterExpressions={[]}
        showTime={false}
        showLabels={false}
        timeZone={'utc'}
      />
    );

    jest.runAllTimers();
    wrapper.update();

    expect(wrapper.find(LogRow).length).toBe(2);
    expect(wrapper.contains('log message 4')).toBeTruthy();
    expect(wrapper.contains('log message 5')).toBeTruthy();

    jest.useRealTimers();
  });
});

const makeLog = (overides: Partial<LogRowModel>): LogRowModel => {
  const uid = overides.uid || '1';
  const entry = `log message ${uid}`;
  return {
    uid,
    logLevel: LogLevel.debug,
    entry,
    hasAnsi: false,
    labels: {},
    raw: entry,
    timestamp: '',
    timeFromNow: '',
    timeEpochMs: 1,
    timeLocal: '',
    timeUtc: '',
    ...overides,
  };
};
