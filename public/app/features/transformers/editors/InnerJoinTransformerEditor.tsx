import React, { useCallback, useEffect } from 'react';

import {
  DataTransformerID,
  SelectableValue,
  standardTransformers,
  TransformerRegistryItem,
  TransformerUIProps,
} from '@grafana/data';
import { JoinMode, SeriesToColumnsOptions } from '@grafana/data/src/transformations/transformers/seriesToColumns';
import { Select } from '@grafana/ui';

import { useAllFieldNamesFromDataFrames } from '../utils';

export const InnerJoinTransformerEditor: React.FC<TransformerUIProps<SeriesToColumnsOptions>> = (props) => {
  const { input, options, onChange } = props;
  const fieldNames = useAllFieldNamesFromDataFrames(input).map((item: string) => ({ label: item, value: item }));
  useEffect(() => {
    if (props.options.mode !== JoinMode.inner) {
      props.onChange({ ...props.options, mode: JoinMode.inner });
    }
  });

  const onSelectField = useCallback(
    (value: SelectableValue<string>) => {
      onChange({
        ...options,
        byField: value.value,
      });
    },
    [onChange, options]
  );

  return (
    <div className="gf-form-inline">
      <div className="gf-form gf-form--grow">
        <div className="gf-form-label width-8">Field name</div>
        <Select options={fieldNames} value={options.byField} onChange={onSelectField} isClearable />
      </div>
    </div>
  );
};

export const innerJoinTransformerRegistryItem: TransformerRegistryItem<SeriesToColumnsOptions> = {
  id: DataTransformerID.innerJoin,
  editor: InnerJoinTransformerEditor,
  transformation: standardTransformers.seriesToColumnsTransformer,
  name: 'Inner join',
  description:
    'Joins many time series/tables by a field and drops rows where the join field cannot be resolved across different time series/tables. This can be used to inner join multiple time series on the _time_ field to show many time series in one table.',
};
