import React from 'react';
import { InlineField, InlineFieldRow, Select } from '@grafana/ui';
const liveTestDataChannels = [
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
        label: 'random-labeled-stream',
        value: 'random-labeled-stream',
        description: 'Value with moving labels',
    },
    {
        label: 'random-20Hz-stream',
        value: 'random-20Hz-stream',
        description: 'Random stream with points in 20Hz',
    },
];
export const GrafanaLiveEditor = ({ onChange, query }) => {
    const onChannelChange = ({ value }) => {
        onChange(Object.assign(Object.assign({}, query), { channel: value }));
    };
    return (React.createElement(InlineFieldRow, null,
        React.createElement(InlineField, { label: "Channel", labelWidth: 14 },
            React.createElement(Select, { width: 32, onChange: onChannelChange, placeholder: "Select channel", options: liveTestDataChannels, value: liveTestDataChannels.find((f) => f.value === query.channel) }))));
};
//# sourceMappingURL=GrafanaLiveEditor.js.map