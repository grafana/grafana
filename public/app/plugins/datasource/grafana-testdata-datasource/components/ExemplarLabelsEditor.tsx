import { memo, useState } from 'react';

import { Button, InlineField, InlineFieldRow, Input } from '@grafana/ui';

import { defaultExemplarLabels } from '../constants';
import type { ExemplarLabel } from '../dataquery';

interface LabelsProps {
  labels?: ExemplarLabel[];
  onChange: (labels: ExemplarLabel[]) => void;
}

interface LabelProps {
  label: ExemplarLabel;
  index: number;
  last: boolean;
  onChange: (index: number, label?: ExemplarLabel) => void;
  onAdd: () => void;
}

const ExemplarLabelEditor = (props: LabelProps) => {
  const { label, last, index, onAdd, onChange } = props;
  const [name, setName] = useState(label.name || '');
  const [link, setLink] = useState(label.link || '');

  const onAction = () => {
    if (last) {
      onAdd();
    } else {
      onChange(index, undefined);
    }
  };

  const onValueChange = <K extends keyof ExemplarLabel, V extends ExemplarLabel[K]>(key: K, value: V) => {
    onChange(index, { ...label, [key]: value });
  };

  return (
    <InlineFieldRow>
      <InlineField
        label="Name"
        labelWidth={14}
        tooltip="Name of the exemplar label. Empty, duplicate and the reserved Time and Value names are ignored"
      >
        <Input
          value={name}
          placeholder="traceID"
          width={20}
          onChange={(e) => setName(e.currentTarget.value)}
          onBlur={() => onValueChange('name', name)}
        />
      </InlineField>
      <InlineField label="Length" tooltip="Number of characters in each generated value">
        <Input
          value={label.length ?? ''}
          type="number"
          min={1}
          placeholder="16"
          width={10}
          onChange={(e) => {
            const value = e.currentTarget.valueAsNumber;
            onValueChange('length', Number.isNaN(value) ? undefined : value);
          }}
        />
      </InlineField>
      <InlineField label="Link" grow tooltip="Optional data link rendered in the exemplar tooltip">
        <Input
          value={link}
          placeholder="https://example.com/trace/${__value.raw}"
          onChange={(e) => setLink(e.currentTarget.value)}
          onBlur={() => onValueChange('link', link)}
        />
      </InlineField>
      <Button
        aria-label={last ? 'Add exemplar label' : 'Remove exemplar label'}
        icon={last ? 'plus' : 'minus'}
        variant="secondary"
        onClick={onAction}
      />
    </InlineFieldRow>
  );
};

export const ExemplarLabelsEditor = memo(({ labels, onChange }: LabelsProps) => {
  const handleChange = (index: number, label?: ExemplarLabel) => {
    const labelsArray = [...(labels ?? defaultExemplarLabels)];
    if (label) {
      labelsArray[index] = { ...label };
    } else {
      // remove the element
      labelsArray.splice(index, 1);
    }
    onChange(labelsArray);
  };

  const onAdd = () => {
    const labelsArray = [...(labels ?? defaultExemplarLabels)];
    labelsArray.push({ ...defaultExemplarLabels[0] });
    onChange(labelsArray);
  };

  const labelsArray = labels ?? defaultExemplarLabels;

  // Unlike the CSV waves this is modelled on, no labels at all is a valid - and
  // interesting - configuration, so the empty list keeps a way back rather than
  // snapping to the default.
  if (!labelsArray.length) {
    return (
      <InlineFieldRow>
        <Button aria-label="Add exemplar label" icon="plus" variant="secondary" onClick={onAdd}>
          Add exemplar label
        </Button>
      </InlineFieldRow>
    );
  }

  return (
    <>
      {labelsArray.map((label, index) => (
        <ExemplarLabelEditor
          key={`${index}/${label.name}`}
          label={label}
          index={index}
          onAdd={onAdd}
          onChange={handleChange}
          last={index === labelsArray.length - 1}
        />
      ))}
    </>
  );
});
ExemplarLabelsEditor.displayName = 'ExemplarLabelsEditor';
