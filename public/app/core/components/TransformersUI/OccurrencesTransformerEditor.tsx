import React, { useCallback, useMemo } from 'react';
import {
  DataTransformerID,
  SelectableValue,
  standardTransformers,
  TransformerRegistyItem,
  TransformerUIProps,
} from '@grafana/data';
import { getAllFieldNamesFromDataFrames } from './OrganizeFieldsTransformerEditor';
import { Select } from '@grafana/ui';

import { OccurrencesTransformerOptions } from '@grafana/data/src/transformations/transformers/occurrences';

export const OccurrencesTransformerEditor: React.FC<TransformerUIProps<OccurrencesTransformerOptions>> = ({
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
      <div className="gf-form gf-form--grow">
        <div className="gf-form-label width-8">Field name</div>
        <Select
          options={fieldNameOptions}
          value={options.byField}
          onChange={onSelectField}
          isClearable
          menuPlacement="bottom"
        />
      </div>
    </div>
  );
};

export const occurrencesTransformRegistryItem: TransformerRegistyItem<OccurrencesTransformerOptions> = {
  id: DataTransformerID.occurrences,
  editor: OccurrencesTransformerEditor,
  transformation: standardTransformers.occurrencesTransformer,
  name: standardTransformers.occurrencesTransformer.name,
  description: standardTransformers.occurrencesTransformer.description,
};
