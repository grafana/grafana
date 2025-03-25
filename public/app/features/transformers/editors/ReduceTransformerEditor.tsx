import { useCallback } from 'react';

import {
  DataTransformerID,
  ReducerID,
  SelectableValue,
  standardTransformers,
  TransformerRegistryItem,
  TransformerUIProps,
  TransformerCategory,
} from '@grafana/data';
import { ReduceTransformerMode, ReduceTransformerOptions } from '@grafana/data/internal';
import { selectors } from '@grafana/e2e-selectors';
import { InlineField, Select, StatsPicker, InlineSwitch } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { getTransformationContent } from '../docs/getTransformationContent';

// TODO:  Minimal implementation, needs some <3
export const ReduceTransformerEditor = ({ options, onChange }: TransformerUIProps<ReduceTransformerOptions>) => {
  const modes: Array<SelectableValue<ReduceTransformerMode>> = [
    {
      label: 'Series to rows',
      value: ReduceTransformerMode.SeriesToRows,
      description: 'Create a table with one row for each series value',
    },
    {
      label: 'Reduce fields',
      value: ReduceTransformerMode.ReduceFields,
      description: 'Collapse each field into a single value',
    },
  ];

  const onSelectMode = useCallback(
    (value: SelectableValue<ReduceTransformerMode>) => {
      const mode = value.value!;
      onChange({
        ...options,
        mode,
        includeTimeField: mode === ReduceTransformerMode.ReduceFields ? !!options.includeTimeField : false,
      });
    },
    [onChange, options]
  );

  const onToggleTime = useCallback(() => {
    onChange({
      ...options,
      includeTimeField: !options.includeTimeField,
    });
  }, [onChange, options]);

  const onToggleLabels = useCallback(() => {
    onChange({
      ...options,
      labelsToFields: !options.labelsToFields,
    });
  }, [onChange, options]);

  return (
    <>
      <InlineField
        label={t('transformers.reduce-transformer-editor.label-mode', 'Mode')}
        data-testid={selectors.components.Transforms.Reduce.modeLabel}
        grow
        labelWidth={16}
      >
        <Select
          options={modes}
          value={modes.find((v) => v.value === options.mode) || modes[0]}
          onChange={onSelectMode}
        />
      </InlineField>
      <InlineField
        label={t('transformers.reduce-transformer-editor.label-calculations', 'Calculations')}
        data-testid={selectors.components.Transforms.Reduce.calculationsLabel}
        grow
        labelWidth={16}
      >
        <StatsPicker
          placeholder={t('transformers.reduce-transformer-editor.placeholder-choose-stat', 'Choose stat')}
          allowMultiple
          stats={options.reducers || []}
          onChange={(stats) => {
            onChange({
              ...options,
              reducers: stats as ReducerID[],
            });
          }}
        />
      </InlineField>
      {options.mode === ReduceTransformerMode.ReduceFields && (
        <InlineField
          htmlFor="include-time-field"
          labelWidth={16}
          label={t('transformers.reduce-transformer-editor.label-include-time', 'Include time')}
        >
          <InlineSwitch id="include-time-field" value={!!options.includeTimeField} onChange={onToggleTime} />
        </InlineField>
      )}
      {options.mode !== ReduceTransformerMode.ReduceFields && (
        <InlineField
          htmlFor="labels-to-fields"
          labelWidth={16}
          label={t('transformers.reduce-transformer-editor.label-labels-to-fields', 'Labels to fields')}
        >
          <InlineSwitch id="labels-to-fields" value={!!options.labelsToFields} onChange={onToggleLabels} />
        </InlineField>
      )}
    </>
  );
};

export const reduceTransformRegistryItem: TransformerRegistryItem<ReduceTransformerOptions> = {
  id: DataTransformerID.reduce,
  editor: ReduceTransformerEditor,
  transformation: standardTransformers.reduceTransformer,
  name: standardTransformers.reduceTransformer.name,
  description: standardTransformers.reduceTransformer.description,
  categories: new Set([TransformerCategory.CalculateNewFields]),
  help: getTransformationContent(DataTransformerID.reduce).helperDocs,
};
