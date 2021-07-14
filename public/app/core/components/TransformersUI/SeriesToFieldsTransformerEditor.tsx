import React, { useCallback } from 'react';
import {
  DataTransformerID,
  SelectableValue,
  standardTransformers,
  TransformerRegistryItem,
  TransformerUIProps,
} from '@grafana/data';
import { Select } from '@grafana/ui';

import { SeriesToColumnsOptions } from '@grafana/data/src/transformations/transformers/seriesToColumns';
import { useAllFieldNamesFromDataFrames } from './utils';

export const SeriesToFieldsTransformerEditor: React.FC<TransformerUIProps<SeriesToColumnsOptions>> = ({
  input,
  options,
  onChange,
}) => {
  const fieldNames = useAllFieldNamesFromDataFrames(input).map((item: string) => ({ label: item, value: item }));

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

export const seriesToFieldsTransformerRegistryItem: TransformerRegistryItem<SeriesToColumnsOptions> = {
  id: DataTransformerID.seriesToColumns,
  editor: SeriesToFieldsTransformerEditor,
  transformation: standardTransformers.seriesToColumnsTransformer,
  name: 'Outer join',
  description:
    'Joins many time series/tables by a field. This can be used to outer join multiple time series on the _time_ field to show many time series in one table.',
};
