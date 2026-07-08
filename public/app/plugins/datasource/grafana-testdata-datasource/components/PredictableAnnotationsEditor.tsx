import { type ChangeEvent } from 'react';

import { InlineField, InlineFieldRow, Input } from '@grafana/ui';

import { type EditorProps } from '../QueryEditor';
import { type PredictableAnnotationsQuery } from '../dataquery';

const durationFields: Array<{
  label: string;
  id: keyof PredictableAnnotationsQuery;
  placeholder: string;
  tooltip: string;
}> = [
  {
    label: 'Event frequency',
    id: 'eventFrequency',
    placeholder: '1h',
    tooltip: 'How often a point-in-time event annotation occurs, as a Go duration string (e.g. "1h", "10m").',
  },
  {
    label: 'Incident frequency',
    id: 'incidentFrequency',
    placeholder: '6h',
    tooltip: 'How often an incident (region) annotation starts, as a Go duration string (e.g. "6h").',
  },
  {
    label: 'Incident duration',
    id: 'incidentDuration',
    placeholder: '10m',
    tooltip: 'How long each incident lasts, as a Go duration string (e.g. "20m").',
  },
];

export const PredictableAnnotationsEditor = ({ onChange, query }: EditorProps) => {
  const onDurationChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    onChange({ target: { name, value } });
  };

  const onSeedChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    onChange({ target: { name, value: Number(value) } });
  };

  return (
    <InlineFieldRow>
      {durationFields.map(({ label, id, placeholder, tooltip }) => (
        <InlineField label={label} labelWidth={18} key={id} tooltip={tooltip}>
          <Input
            width={12}
            type="text"
            name={id}
            id={`predictableAnnotations.${id}-${query.refId}`}
            value={query.predictableAnnotations?.[id]}
            placeholder={placeholder}
            onChange={onDurationChange}
          />
        </InlineField>
      ))}
      <InlineField
        label="Seed"
        labelWidth={14}
        tooltip="Seed used to deterministically pick each annotation's text and tags. The same seed always produces the same annotations, independent of the selected time range."
      >
        <Input
          width={12}
          type="number"
          name="seed"
          id={`predictableAnnotations.seed-${query.refId}`}
          value={query.predictableAnnotations?.seed}
          placeholder="1"
          onChange={onSeedChange}
        />
      </InlineField>
    </InlineFieldRow>
  );
};
