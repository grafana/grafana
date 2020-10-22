import React from 'react';
import { InlineField, InlineFieldRow, Select } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';
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
          value={liveTestDataChannels.find(f => f.value === query.channel)}
        />
      </InlineField>
    </InlineFieldRow>
  );
};
