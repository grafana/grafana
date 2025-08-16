import { ChangeEvent, useCallback } from 'react';

import {
  DataTransformerID,
  SelectableValue,
  standardTransformers,
  TransformerRegistryItem,
  TransformerUIProps,
  TransformerCategory,
} from '@grafana/data';
import { JoinByFieldOptions, JoinMode } from '@grafana/data/internal';
import { t } from '@grafana/i18n';
import { getTemplateSrv } from '@grafana/runtime';
import { Select, InlineFieldRow, InlineField, Input } from '@grafana/ui';
import { useFieldDisplayNames, useSelectOptions } from '@grafana/ui/internal';

import { getTransformationContent } from '../docs/getTransformationContent';
import darkImage from '../images/dark/joinByField.svg';
import lightImage from '../images/light/joinByField.svg';

export function SeriesToFieldsTransformerEditor({ input, options, onChange }: TransformerUIProps<JoinByFieldOptions>) {
  const names = useFieldDisplayNames(input);
  const fieldNames = useSelectOptions(names);

  const modes = [
    {
      value: JoinMode.outer,
      label: t('transformers.series-to-fields-transformer-editor.modes.label.outer-time-series', 'Outer (time series)'),
      description: t(
        'transformers.series-to-fields-transformer-editor.modes.description.keep-all-rows',
        'Keep all rows from any table with a value. Join on distinct field values. Performant and best used for time series.'
      ),
    },
    {
      value: JoinMode.outerTabular,
      label: t('transformers.series-to-fields-transformer-editor.modes.label.outer-tabular', 'Outer (tabular)'),
      description: t(
        'transformers.series-to-fields-transformer-editor.modes.description.join-on-a-field',
        'Join on a field value with duplicated values. Non performant outer join best used for tabular(SQL like) data.'
      ),
    },
    {
      value: JoinMode.inner,
      label: t('transformers.series-to-fields-transformer-editor.modes.label.inner', 'Inner'),
      description: t(
        'transformers.series-to-fields-transformer-editor.modes.description.combine-data-from-two-tables',
        'Combine data from two tables whenever there are matching values in a fields common to both tables.'
      ),
    },
  ];

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

  const onChangeFrameAlias = useCallback(
    (evt: ChangeEvent<HTMLInputElement>) => {
      onChange({
        ...options,
        frameAlias: evt.target.value,
      });
    },
    [onChange, options]
  );

  return (
    <>
      <InlineFieldRow>
        <InlineField
          label={t('transformers.series-to-fields-transformer-editor.label-mode', 'Mode')}
          labelWidth={8}
          grow
        >
          <Select options={modes} value={options.mode ?? JoinMode.outer} onChange={onSetMode} />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField
          label={t('transformers.series-to-fields-transformer-editor.label-field', 'Field')}
          labelWidth={8}
          grow
        >
          <Select
            options={[...fieldNames, ...variables]}
            value={options.byField}
            onChange={onSelectField}
            /* don't translate here as this references a field name */
            /* eslint-disable-next-line @grafana/i18n/no-untranslated-strings */
            placeholder="time"
            isClearable
          />
        </InlineField>
        <InlineField
          htmlFor="frame-alias"
          labelWidth={16}
          label={t('transformers.reduce-transformer-editor.label-frame-alias', 'Frame Alias')}
        >
          <Input id="frame-alias" value={options.frameAlias ?? ''} onChange={onChangeFrameAlias} />
        </InlineField>
      </InlineFieldRow>
    </>
  );
}

export const getJoinByFieldTransformerRegistryItem: () => TransformerRegistryItem<JoinByFieldOptions> = () => ({
  id: DataTransformerID.joinByField,
  aliasIds: [DataTransformerID.seriesToColumns],
  editor: SeriesToFieldsTransformerEditor,
  transformation: standardTransformers.joinByFieldTransformer,
  name: t('transformers.join-by-field-transformer-editor.name.join-by-field', 'Join by field'),
  description: t(
    'transformers.join-by-field-transformer-editor.description.combine-rows-from-2-tables',
    'Combine rows from 2+ tables, based on a related field.'
  ),
  categories: new Set([TransformerCategory.Combine]),
  help: getTransformationContent(DataTransformerID.joinByField).helperDocs,
  imageDark: darkImage,
  imageLight: lightImage,
});
