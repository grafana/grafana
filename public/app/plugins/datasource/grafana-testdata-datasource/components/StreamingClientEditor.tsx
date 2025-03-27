import { ChangeEvent } from 'react';

import { SelectableValue } from '@grafana/data';
import { InlineField, InlineFieldRow, Input, Select } from '@grafana/ui';

import { EditorProps } from '../QueryEditor';

const streamingClientFields = [
  { label: 'Speed (ms)', id: 'speed', placeholder: 'value', min: 10, step: 10 },
  { label: 'Spread', id: 'spread', placeholder: 'value', min: 0.5, step: 0.1 },
  { label: 'Noise', id: 'noise', placeholder: 'value', min: 0, step: 0.1 },
  { label: 'Bands', id: 'bands', placeholder: 'bands', min: 0, step: 1 },
] as const;

const types = [
  { value: 'signal', label: 'Signal' },
  { value: 'logs', label: 'Logs' },
  { value: 'fetch', label: 'Fetch' },
  { value: 'traces', label: 'Traces' },
  { value: 'watch', label: 'Watch' },
];

export const StreamingClientEditor = ({ onChange, query }: EditorProps) => {
  const onSelectChange = ({ value }: SelectableValue) => {
    onChange({ target: { name: 'type', value } });
  };

  // Convert values to numbers before saving
  const onInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    onChange({ target: { name, value: Number(value) } });
  };

  const streamType = query?.stream?.type || 'signal';
  const fields =
    streamType === 'signal'
      ? streamingClientFields
      : ['logs', 'traces', 'watch'].includes(streamType)
        ? [streamingClientFields[0]] // speed
        : [];

  return (
    <InlineFieldRow>
      <InlineField label="Type" labelWidth={14}>
        <Select
          width={32}
          onChange={onSelectChange}
          defaultValue={types[0]}
          options={types}
          value={query?.stream?.type}
        />
      </InlineField>
      {fields.map(({ label, id, min, step, placeholder }) => {
        return (
          <InlineField label={label} labelWidth={14} key={id}>
            <Input
              width={32}
              type="number"
              id={`stream.${id}-${query.refId}`}
              name={id}
              min={min}
              step={step}
              value={query.stream?.[id]}
              placeholder={placeholder}
              onChange={onInputChange}
            />
          </InlineField>
        );
      })}

      {query?.stream?.type === 'fetch' && (
        <InlineField label="URL" labelWidth={14} grow>
          <Input
            type="text"
            name="url"
            id={`stream.url-${query.refId}`}
            value={query?.stream?.url}
            placeholder="Fetch URL"
            onChange={onChange}
          />
        </InlineField>
      )}
    </InlineFieldRow>
  );
};
