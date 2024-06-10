import React from 'react';

import { SelectableValue } from '@grafana/data';
import { InlineField, InlineFieldRow, Select } from '@grafana/ui';

import { EditorProps } from '../QueryEditor';

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

export const GrafanaLiveEditor = ({ onChange, query }: EditorProps) => {
  const onChannelChange = ({ value }: SelectableValue<string>) => {
    onChange({ ...query, channel: value });
  };

  return (
    <InlineFieldRow>
      <InlineField label="Channel" labelWidth={14}>
        <Select
          width={32}
          onChange={onChannelChange}
          placeholder="Select channel"
          options={liveTestDataChannels}
          value={liveTestDataChannels.find((f) => f.value === query.channel)}
        />
      </InlineField>
    </InlineFieldRow>
  );
};
