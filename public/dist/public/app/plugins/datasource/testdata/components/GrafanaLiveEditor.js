import { __assign } from "tslib";
import React from 'react';
import { InlineField, InlineFieldRow, Select } from '@grafana/ui';
var liveTestDataChannels = [
    {
        label: 'random-2s-stream',
        value: 'random-2s-stream',
        description: 'Random stream with points every 2s',
    },
    {
        label: 'random-flakey-stream',
        value: 'random-flakey-stream',
        description: 'Stream that returns data in random intervals',
    },
    {
        label: 'random-20Hz-stream',
        value: 'random-20Hz-stream',
        description: 'Random stream with points in 20Hz',
    },
];
export var GrafanaLiveEditor = function (_a) {
    var onChange = _a.onChange, query = _a.query;
    var onChannelChange = function (_a) {
        var value = _a.value;
        onChange(__assign(__assign({}, query), { channel: value }));
    };
    return (React.createElement(InlineFieldRow, null,
        React.createElement(InlineField, { label: "Channel", labelWidth: 14 },
            React.createElement(Select, { menuShouldPortal: true, width: 32, onChange: onChannelChange, placeholder: "Select channel", options: liveTestDataChannels, value: liveTestDataChannels.find(function (f) { return f.value === query.channel; }) }))));
};
//# sourceMappingURL=GrafanaLiveEditor.js.map