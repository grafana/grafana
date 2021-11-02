import { __assign } from "tslib";
import React from 'react';
import { LogLevel, MutableDataFrame } from '@grafana/data';
import { mount } from 'enzyme';
import { LiveLogsWithTheme } from './LiveLogs';
describe('LiveLogs', function () {
    it('renders logs', function () {
        var rows = [makeLog({ uid: '1' }), makeLog({ uid: '2' }), makeLog({ uid: '3' })];
        var wrapper = mount(React.createElement(LiveLogsWithTheme, { logRows: rows, timeZone: 'utc', stopLive: function () { }, onPause: function () { }, onResume: function () { }, isPaused: true }));
        expect(wrapper.contains('log message 1')).toBeTruthy();
        expect(wrapper.contains('log message 2')).toBeTruthy();
        expect(wrapper.contains('log message 3')).toBeTruthy();
    });
    it('renders new logs only when not paused', function () {
        var rows = [makeLog({ uid: '1' }), makeLog({ uid: '2' }), makeLog({ uid: '3' })];
        var wrapper = mount(React.createElement(LiveLogsWithTheme, { logRows: rows, timeZone: 'utc', stopLive: function () { }, onPause: function () { }, onResume: function () { }, isPaused: true }));
        wrapper.setProps(__assign(__assign({}, wrapper.props()), { logRows: [makeLog({ uid: '4' }), makeLog({ uid: '5' }), makeLog({ uid: '6' })] }));
        expect(wrapper.contains('log message 1')).toBeTruthy();
        expect(wrapper.contains('log message 2')).toBeTruthy();
        expect(wrapper.contains('log message 3')).toBeTruthy();
        wrapper.find('LiveLogs').instance().scrollContainerRef.current.scrollTo = function () { };
        wrapper.setProps(__assign(__assign({}, wrapper.props()), { isPaused: false }));
        expect(wrapper.contains('log message 4')).toBeTruthy();
        expect(wrapper.contains('log message 5')).toBeTruthy();
        expect(wrapper.contains('log message 6')).toBeTruthy();
    });
    it('renders ansi logs', function () {
        var rows = [
            makeLog({ uid: '1' }),
            makeLog({ hasAnsi: true, raw: 'log message \u001B[31m2\u001B[0m', uid: '2' }),
            makeLog({ hasAnsi: true, raw: 'log message \u001B[31m3\u001B[0m', uid: '3' }),
        ];
        var wrapper = mount(React.createElement(LiveLogsWithTheme, { logRows: rows, timeZone: 'utc', stopLive: function () { }, onPause: function () { }, onResume: function () { }, isPaused: true }));
        expect(wrapper.contains('log message 1')).toBeTruthy();
        expect(wrapper.contains('log message 2')).not.toBeTruthy();
        expect(wrapper.contains('log message 3')).not.toBeTruthy();
        expect(wrapper.find('LogMessageAnsi')).toHaveLength(2);
        expect(wrapper.find('LogMessageAnsi').first().prop('value')).toBe('log message \u001B[31m2\u001B[0m');
        expect(wrapper.find('LogMessageAnsi').last().prop('value')).toBe('log message \u001B[31m3\u001B[0m');
    });
});
var makeLog = function (overrides) {
    var uid = overrides.uid || '1';
    var entry = "log message " + uid;
    return __assign({ uid: uid, entryFieldIndex: 0, rowIndex: 0, dataFrame: new MutableDataFrame(), logLevel: LogLevel.debug, entry: entry, hasAnsi: false, hasUnescapedContent: false, labels: {}, raw: entry, timeFromNow: '', timeEpochMs: 1, timeEpochNs: '1000000', timeLocal: '', timeUtc: '' }, overrides);
};
//# sourceMappingURL=LiveLogs.test.js.map