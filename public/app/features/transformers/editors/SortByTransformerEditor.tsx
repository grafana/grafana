import { useCallback } from 'react';

import {
  DataTransformerID,
  standardTransformers,
  TransformerRegistryItem,
  TransformerUIProps,
  TransformerCategory,
} from '@grafana/data';
import { SortByField, SortByTransformerOptions } from '@grafana/data/internal';
import { t } from '@grafana/i18n';
import { getTemplateSrv } from '@grafana/runtime';
import { InlineField, InlineSwitch, InlineFieldRow, Select } from '@grafana/ui';

import { getTransformationContent } from '../docs/getTransformationContent';
import darkImage from '../images/dark/sortBy.svg';
import lightImage from '../images/light/sortBy.svg';
import { useAllFieldNamesFromDataFrames } from '../utils';

export const SortByTransformerEditor = ({ input, options, onChange }: TransformerUIProps<SortByTransformerOptions>) => {
  const fieldNames = useAllFieldNamesFromDataFrames(input).map((item: string) => ({ label: item, value: item }));
  const templateSrv = getTemplateSrv();
  const variables = templateSrv.getVariables().map((v) => ({ label: '$' + v.name, value: '$' + v.name }));

  // Only supports single sort for now
  const onSortChange = useCallback(
    (idx: number, cfg: SortByField) => {
      onChange({ ...options, sort: [cfg] });
    },
    [onChange, options]
  );

  const sorts: SortByField[] = options.sort?.length ? options.sort : [{} as SortByField];

  return (
    <div>
      {sorts.map((s, index) => {
        return (
          <InlineFieldRow key={`${s.field}/${index}`}>
            <InlineField
              label={t('transformers.sort-by-transformer-editor.label-field', 'Field')}
              labelWidth={10}
              grow={true}
            >
              <Select
                options={[...fieldNames, ...variables]}
                value={s.field}
                placeholder={t('transformers.sort-by-transformer-editor.placeholder-select-field', 'Select field')}
                onChange={(v) => {
                  onSortChange(index, { ...s, field: v.value! });
                }}
              />
            </InlineField>
            <InlineField label={t('transformers.sort-by-transformer-editor.label-reverse', 'Reverse')}>
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

export const getSortByTransformRegistryItem: () => TransformerRegistryItem<SortByTransformerOptions> = () => ({
  id: DataTransformerID.sortBy,
  editor: SortByTransformerEditor,
  transformation: standardTransformers.sortByTransformer,
  name: t('transformers.sort-by-transformer-editor.name.sort-by', 'Sort by'),
  description: t('transformers.sort-by-transformer-editor.description.sort-fields', 'Sort fields in a frame.'),
  categories: new Set([TransformerCategory.ReorderAndRename]),
  help: getTransformationContent(DataTransformerID.sortBy).helperDocs,
  imageDark: darkImage,
  imageLight: lightImage,
});
