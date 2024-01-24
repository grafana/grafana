import React from 'react';

import { StandardEditorProps } from '@grafana/data';
import { Select } from '@grafana/ui';

import { NodeGraphOptions } from '../types';

type Settings = { placeholder?: string };
type FrameSelectProps = StandardEditorProps<string, Settings, NodeGraphOptions, undefined>;

export const FrameSelector = ({ value, onChange, context, item }: FrameSelectProps) => {
  const frameOptions = context.data.map((df, i) => ({
    label: df.name,
    value: df.name,
  }));

  return (
    <Select
      value={value}
      onChange={(v) => {
        onChange(v?.value);
      }}
      placeholder={item.settings?.placeholder}
      options={frameOptions}
      isClearable={true}
    />
  );
};
