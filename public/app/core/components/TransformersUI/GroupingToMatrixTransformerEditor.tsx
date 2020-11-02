import React from 'react';
import { DataTransformerID, standardTransformers, TransformerRegistyItem, TransformerUIProps } from '@grafana/data';
import { Input } from '@grafana/ui';
import { GroupingToMatrixTransformerOptions } from '@grafana/data/src/transformations/transformers/groupingToMatrix';

export const GroupingToMatrixTransformerEditor: React.FC<TransformerUIProps<GroupingToMatrixTransformerOptions>> = ({
  input,
  options,
  onChange,
}) => {
  return (
    <div className="gf-form-inline">
      <div className="gf-form gf-form--grow">
        <div className="gf-form-label width-8">Column</div>
        <Input
          className="width-18"
          placeholder="Choose Column Field"
          value={options.columnField ?? ''}
          onChange={input => {
            onChange({
              ...options,
              columnField: input.currentTarget.value,
            });
          }}
        />
      </div>
      <div className="gf-form gf-form--grow">
        <div className="gf-form-label width-8">Row</div>
        <Input
          className="width-18"
          placeholder="Choose Row Field"
          value={options.rowField ?? ''}
          onChange={input => {
            onChange({
              ...options,
              rowField: input.currentTarget.value,
            });
          }}
        />
      </div>
      <div className="gf-form gf-form--grow">
        <div className="gf-form-label width-8">Value</div>
        <Input
          className="width-18"
          placeholder="Choose Value Field"
          value={options.valueField ?? ''}
          onChange={input => {
            onChange({
              ...options,
              valueField: input.currentTarget.value,
            });
          }}
        />
      </div>
    </div>
  );
};

export const groupingToMatrixTransformerRegistryItem: TransformerRegistyItem<GroupingToMatrixTransformerOptions> = {
  id: DataTransformerID.groupingToMatrix,
  editor: GroupingToMatrixTransformerEditor,
  transformation: standardTransformers.groupingToMatrixTransformer,
  name: 'Grouping to matrix',
  description: `Takes a three fields combination and produces a Matrix`,
};
