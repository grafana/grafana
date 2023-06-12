import React, { useCallback } from 'react';

import { DataTransformerID, standardTransformers, TransformerRegistryItem, TransformerUIProps } from '@grafana/data';
import { SortByField, SortByTransformerOptions } from '@grafana/data/src/transformations/transformers/sortBy';
import { InlineField, InlineSwitch, InlineFieldRow, Select } from '@grafana/ui';

import { useAllFieldNamesFromDataFrames } from '../utils';

export const SortByTransformerEditor = ({ input, options, onChange }: TransformerUIProps<SortByTransformerOptions>) => {
  const fieldNames = useAllFieldNamesFromDataFrames(input).map((item: string) => ({ label: item, value: item }));

  // Only supports single sort for now
  const onSortChange = useCallback(
    (idx: number, cfg: SortByField) => {
      onChange({ ...options, sort: [cfg] });
    },
    [onChange, options]
  );

  const sorts = options.sort?.length ? options.sort : [{} as SortByField];

  return (
    <div>
      {sorts.map((s, index) => {
        return (
          <InlineFieldRow key={`${s.field}/${index}`}>
            <InlineField label="Field" labelWidth={10} grow={true}>
              <Select
                options={fieldNames}
                value={s.field}
                placeholder="Select field"
                onChange={(v) => {
                  onSortChange(index, { ...s, field: v.value! });
                }}
              />
            </InlineField>
            <InlineField label="Reverse">
              <InlineSwitch
                value={!!s.desc}
                onChange={() => {
                  onSortChange(index, { ...s, desc: !!!s.desc });
                }}
              />
            </InlineField>
          </InlineFieldRow>
        );
      })}
    </div>
  );
};

export const sortByTransformRegistryItem: TransformerRegistryItem<SortByTransformerOptions> = {
  id: DataTransformerID.sortBy,
  editor: SortByTransformerEditor,
  transformation: standardTransformers.sortByTransformer,
  name: standardTransformers.sortByTransformer.name,
  description: standardTransformers.sortByTransformer.description,
};
