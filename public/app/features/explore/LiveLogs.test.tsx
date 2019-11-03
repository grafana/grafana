import React from 'react';
import { LogLevel, LogRowModel, MutableDataFrame } from '@grafana/data';
import { mount } from 'enzyme';
import { LiveLogsWithTheme } from './LiveLogs';

describe('LiveLogs', () => {
  it('renders logs', () => {
    const rows: LogRowModel[] = [makeLog({ uid: '1' }), makeLog({ uid: '2' }), makeLog({ uid: '3' })];
    const wrapper = mount(
      <LiveLogsWithTheme
        logRows={rows}
        timeZone={'utc'}
        stopLive={() => {}}
        onPause={() => {}}
        onResume={() => {}}
        isPaused={true}
      />
    );

    expect(wrapper.contains('log message 1')).toBeTruthy();
    expect(wrapper.contains('log message 2')).toBeTruthy();
    expect(wrapper.contains('log message 3')).toBeTruthy();
  });

  it('renders new logs only when not paused', () => {
    const rows: LogRowModel[] = [makeLog({ uid: '1' }), makeLog({ uid: '2' }), makeLog({ uid: '3' })];
    const wrapper = mount(
      <LiveLogsWithTheme
        logRows={rows}
        timeZone={'utc'}
        stopLive={() => {}}
        onPause={() => {}}
        onResume={() => {}}
        isPaused={true}
      />
    );

    wrapper.setProps({
      ...wrapper.props(),
      logRows: [makeLog({ uid: '4' }), makeLog({ uid: '5' }), makeLog({ uid: '6' })],
    });

    expect(wrapper.contains('log message 1')).toBeTruthy();
    expect(wrapper.contains('log message 2')).toBeTruthy();
    expect(wrapper.contains('log message 3')).toBeTruthy();

    (wrapper.find('LiveLogs').instance() as any).liveEndDiv.scrollIntoView = () => {};

    wrapper.setProps({
      ...wrapper.props(),
      isPaused: false,
    });

    expect(wrapper.contains('log message 4')).toBeTruthy();
    expect(wrapper.contains('log message 5')).toBeTruthy();
    expect(wrapper.contains('log message 6')).toBeTruthy();
  });
});

const makeLog = (overides: Partial<LogRowModel>): LogRowModel => {
  const uid = overides.uid || '1';
  const entry = `log message ${uid}`;
  return {
    uid,
    entryFieldIndex: 0,
    rowIndex: 0,
    dataFrame: new MutableDataFrame(),
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
