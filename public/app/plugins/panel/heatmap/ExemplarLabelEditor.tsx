import React from 'react';

import { StandardEditorProps } from '@grafana/data';
import { InlineField, TagsInput } from '@grafana/ui';

export const ExemplarLabelEditor = ({ value, onChange, context }: StandardEditorProps<string[]>) => {
  const labels = context.options?.tooltip?.exemplarLabels;
  const setExemplarLabels = (ls?: string[]) => {
    onChange(ls);
  };
  return (
    <InlineField
      label="Labels"
      tooltip="Add exemplar labels to be displayed on exemplar tooltip. Note that the order of labels added is also important and the same order is displayed on the exemplar tooltip"
    >
      <TagsInput placeholder="trace_id" tags={labels} onChange={(ls) => setExemplarLabels(ls)} />
    </InlineField>
  );
};
