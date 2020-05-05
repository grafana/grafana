import React from 'react';
import { StatsPicker } from '../StatsPicker/StatsPicker';
import {
  ReduceTransformerOptions,
  DataTransformerID,
  ReducerID,
  standardTransformers,
  TransformerRegistryItem,
  TransformerUIProps,
} from '@grafana/data';

// TODO:  Minimal implementation, needs some <3
export const ReduceTransformerEditor: React.FC<TransformerUIProps<ReduceTransformerOptions>> = ({
  options,
  onChange,
}) => {
  return (
    <div className="gf-form-inline">
      <div className="gf-form gf-form--grow">
        <div className="gf-form-label width-8">Calculations</div>
        <StatsPicker
          className="flex-grow-1"
          placeholder="Choose Stat"
          allowMultiple
          stats={options.reducers || []}
          onChange={stats => {
            onChange({
              ...options,
              reducers: stats as ReducerID[],
            });
          }}
        />
      </div>
    </div>
  );
};

export const reduceTransformRegistryItem: TransformerRegistryItem<ReduceTransformerOptions> = {
  id: DataTransformerID.reduce,
  editor: ReduceTransformerEditor,
  transformation: standardTransformers.reduceTransformer,
  name: standardTransformers.reduceTransformer.name,
  description: standardTransformers.reduceTransformer.description,
};
