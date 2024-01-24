import React from 'react';

import { StandardEditorProps } from '@grafana/data';
import { Select } from '@grafana/ui';

import { NodeGraphOptions } from '../types';
import { useCategorizeFrames } from '../useCategorizeFrames';

export enum FrameType {
  nodes,
  edges,
}

type Settings = { placeholder?: string; frameType: FrameType; nodesFrameName?: string; edgesFrameName?: string };
type RawFieldNameSelectProps = StandardEditorProps<string, Settings, NodeGraphOptions, undefined>;

export const RawFieldSelector = ({ value, onChange, context, item }: RawFieldNameSelectProps) => {
  const { edges, nodes } = useCategorizeFrames(
    context.data,
    item.settings?.nodesFrameName,
    item.settings?.edgesFrameName
  );

  const fieldOptions = [];

  if (item.settings?.frameType === FrameType.edges) {
    for (const frame of edges) {
      fieldOptions.push(...frame.fields.map((f) => ({ label: f.name, value: f.name })));
    }
  } else {
    for (const frame of nodes) {
      fieldOptions.push(...frame.fields.map((f) => ({ label: f.name, value: f.name })));
    }
  }

  return (
    <Select
      value={value}
      onChange={(v) => {
        onChange(v?.value);
      }}
      placeholder={item.settings?.placeholder}
      options={fieldOptions}
      isClearable={true}
    />
  );
};
