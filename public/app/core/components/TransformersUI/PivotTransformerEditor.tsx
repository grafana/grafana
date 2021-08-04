import React, { useCallback } from 'react';
import {
  DataTransformerID,
  standardTransformers,
  TransformerRegistryItem,
  TransformerUIProps,
  SelectableValue,
} from '@grafana/data';
import { InlineFormLabel, Select } from '@grafana/ui';
import { PivotTransformerOptions, PivotAggregationOptions } from '@grafana/data/src/transformations/transformers/pivot';
import { useAllFieldNamesFromDataFrames } from './utils';

interface PivotTransformerEditorProps extends TransformerUIProps<PivotTransformerOptions> {}

const PivotTransformerEditor = (props: PivotTransformerEditorProps) => {
  const { options, onChange } = props;
  const fields = useAllFieldNamesFromDataFrames(props.input);
  const allFields: Array<SelectableValue<string>> = (fields || []).map((f) => {
    return { label: f, value: f };
  });
  const onValueChange = useCallback(
    (key: keyof PivotTransformerOptions, value: string) => {
      onChange({
        ...options,
        [key]: value || '',
      });
    },
    [options, onChange]
  );
  return (
    <>
      <div className="gf-form">
        <InlineFormLabel width={8}>Row</InlineFormLabel>
        <Select
          width={20}
          onChange={(e) => onValueChange('row', e?.value!)}
          options={allFields}
          value={props.options.row}
        />
      </div>
      <div className="gf-form">
        <InlineFormLabel width={8}>Column</InlineFormLabel>
        <Select
          width={20}
          onChange={(e) => onValueChange('column', e?.value!)}
          options={allFields}
          value={props.options.column}
        />
      </div>
      <div className="gf-form">
        <InlineFormLabel width={8}>Value</InlineFormLabel>
        <Select
          width={20}
          onChange={(e) => onValueChange('metric', e?.value!)}
          options={allFields}
          value={props.options.metric}
        />
        <Select
          width={20}
          onChange={(e) => onValueChange('aggregation', e?.value!)}
          options={PivotAggregationOptions}
          value={props.options.aggregation}
        />
      </div>
    </>
  );
};

export const pivotTransformRegistryItem: TransformerRegistryItem<PivotTransformerOptions> = {
  id: DataTransformerID.pivot,
  editor: PivotTransformerEditor,
  transformation: standardTransformers.pivotTransformer,
  name: 'Pivot',
  description: 'Pivot fields',
};
