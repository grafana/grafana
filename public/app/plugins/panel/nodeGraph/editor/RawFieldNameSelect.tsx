import React from 'react';

import { StandardEditorProps } from '@grafana/data';
import { Select } from '@grafana/ui';

import { NodeGraphOptions } from '../types';

type RawFieldNameSelectProps = StandardEditorProps<string, NodeGraphOptions, undefined>;

export const RawFieldSelector = ({ value, onChange, context, item }: RawFieldNameSelectProps) => {
  const fieldOptions = [];
  for (const frame of context.data) {
    fieldOptions.push(...frame.fields.map((f) => ({ label: f.name, value: f.name })));
  }
  return (
    <Select
      value={value}
      onChange={(v) => {
        onChange(v?.value);
      }}
      options={fieldOptions}
      isClearable={true}
    />
  );
};
