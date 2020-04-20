import React, { useMemo, useCallback } from 'react';
import {
  DataTransformerID,
  standardTransformers,
  TransformerRegistyItem,
  TransformerUIProps,
  SeriesToColumnsOptions,
  SelectableValue,
} from '@grafana/data';
import { getAllFieldNamesFromDataFrames } from './OrganizeFieldsTransformerEditor';
import { Select } from '../Select/Select';

export const SeriesToFieldsTransformerEditor: React.FC<TransformerUIProps<SeriesToColumnsOptions>> = ({
  input,
  options,
  onChange,
}) => {
  const fieldNames = useMemo(() => getAllFieldNamesFromDataFrames(input), [input]);
  const fieldNameOptions = fieldNames.map((item: string) => ({ label: item, value: item }));

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
      <div className="gf-form">
        <div className="gf-form-label">Field</div>
        <Select options={fieldNameOptions} value={options.byField} onChange={onSelectField} />
      </div>
    </div>
  );
};

export const seriesToFieldsTransformerRegistryItem: TransformerRegistyItem<SeriesToColumnsOptions> = {
  id: DataTransformerID.seriesToColumns,
  editor: SeriesToFieldsTransformerEditor,
  transformation: standardTransformers.seriesToColumnsTransformer,
  name: 'Join by field',
  description: 'Joins many time series / data frames by a field',
};
