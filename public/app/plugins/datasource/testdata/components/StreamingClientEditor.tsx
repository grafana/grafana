import { InlineField, InlineFieldRow, Input, Select } from '@grafana/ui';
import React from 'react';
import { SelectableValue } from '@grafana/data';

const streamingClientFields = [
  { label: 'Speed (ms)', id: 'speed', placeholder: 'value', min: 10, step: 10 },
  { label: 'Spread', id: 'spread', placeholder: 'value', min: 0.5, step: 0.1 },
  { label: 'Noise', id: 'noise', placeholder: 'value', min: 0, step: 0.1 },
  { label: 'Bands', id: 'bands', placeholder: 'bands', min: 0, step: 1 },
  { label: 'URL', id: 'url', placeholder: 'Fetch URL', type: 'text' },
];

const types = [
  { label: 'Signal', value: 'signal' },
  { value: 'logs', label: 'Logs' },
  { value: 'fetch', label: 'Fetch' },
];
export interface Props {
  onChange: any;
  query: any;
}

export const StreamingClientEditor = ({ onChange, query }: Partial<Props>) => {
  const onSelectChange = ({ value }: SelectableValue) => {
    onChange({ target: { name: 'type', value } });
  };
  return (
    <InlineFieldRow>
      <InlineField label="Type" labelWidth={14}>
        <Select width={32} onChange={onSelectChange} defaultValue={types[0]} options={types} />
      </InlineField>
      {query?.stream?.type === 'signal' &&
        streamingClientFields.map(({ label, id, min, step, placeholder }) => {
          return (
            <InlineField label={label} labelWidth={14} key={id}>
              <Input
                width={32}
                type="number"
                id={`stream.${id}`}
                name={id}
                min={min}
                step={step}
                value={query?.stream?.[id]}
                placeholder={placeholder}
                onChange={onChange}
              />
            </InlineField>
          );
        })}

      {query?.stream?.type === 'fetch' && (
        <InlineField label="URL" labelWidth={14} grow>
          <Input
            type="text"
            name="url"
            id="stream.url"
            value={query?.stream?.url}
            placeholder="Fetch URL"
            onChange={onChange}
          />
        </InlineField>
      )}

      {query?.stream?.type === 'logs' && (
        <InlineField label="Lines" labelWidth={14}>
          <Input
            type="number"
            id="lines"
            name="lines"
            value={query?.stream?.url}
            placeholder="10"
            onChange={onChange}
          />
        </InlineField>
      )}
    </InlineFieldRow>
  );
};
