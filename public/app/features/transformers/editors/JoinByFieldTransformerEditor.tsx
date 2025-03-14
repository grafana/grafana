import { useCallback } from 'react';

import {
  DataTransformerID,
  SelectableValue,
  standardTransformers,
  TransformerRegistryItem,
  TransformerUIProps,
  TransformerCategory,
} from '@grafana/data';
import { JoinByFieldOptions, JoinMode } from '@grafana/data/src/transformations/transformers/joinByField';
import { getTemplateSrv } from '@grafana/runtime';
import { Select, InlineFieldRow, InlineField } from '@grafana/ui';
import { useFieldDisplayNames, useSelectOptions } from '@grafana/ui/internal';

import { getTransformationContent } from '../docs/getTransformationContent';

const modes = [
  {
    value: JoinMode.outer,
    label: 'OUTER (TIME SERIES)',
    description:
      'Keep all rows from any table with a value. Join on distinct field values. Performant and best used for time series.',
  },
  {
    value: JoinMode.outerTabular,
    label: 'OUTER (TABULAR)',
    description:
      'Join on a field value with duplicated values. Non performant outer join best used for tabular(SQL like) data.',
  },
  {
    value: JoinMode.inner,
    label: 'INNER',
    description: 'Combine data from two tables whenever there are matching values in a fields common to both tables.',
  },
];

export function SeriesToFieldsTransformerEditor({ input, options, onChange }: TransformerUIProps<JoinByFieldOptions>) {
  const names = useFieldDisplayNames(input);
  const fieldNames = useSelectOptions(names);

  const variables = getTemplateSrv()
    .getVariables()
    .map((v) => {
      return { value: '$' + v.name, label: '$' + v.name };
    });

  const onSelectField = useCallback(
    (value: SelectableValue<string>) => {
      onChange({
        ...options,
        byField: value?.value,
      });
    },
    [onChange, options]
  );

  const onSetMode = useCallback(
    (value: SelectableValue<JoinMode>) => {
      onChange({
        ...options,
        mode: value?.value,
      });
    },
    [onChange, options]
  );

  return (
    <>
      <InlineFieldRow>
        <InlineField label="Mode" labelWidth={8} grow>
          <Select options={modes} value={options.mode ?? JoinMode.outer} onChange={onSetMode} />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField label="Field" labelWidth={8} grow>
          <Select
            options={[...fieldNames, ...variables]}
            value={options.byField}
            onChange={onSelectField}
            placeholder="time"
            isClearable
          />
        </InlineField>
      </InlineFieldRow>
    </>
  );
}

export const joinByFieldTransformerRegistryItem: TransformerRegistryItem<JoinByFieldOptions> = {
  id: DataTransformerID.joinByField,
  aliasIds: [DataTransformerID.seriesToColumns],
  editor: SeriesToFieldsTransformerEditor,
  transformation: standardTransformers.joinByFieldTransformer,
  name: standardTransformers.joinByFieldTransformer.name,
  description: standardTransformers.joinByFieldTransformer.description,
  categories: new Set([TransformerCategory.Combine]),
  help: getTransformationContent(DataTransformerID.joinByField).helperDocs,
};
