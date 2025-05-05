import { useEffect } from 'react';

import {
  DataTransformerID,
  TransformerRegistryItem,
  TransformerUIProps,
  TransformerCategory,
  fieldMatchers,
  FieldMatcherID,
  Field,
} from '@grafana/data';
import { InlineField, Select } from '@grafana/ui';
import { FieldNamePicker } from '@grafana/ui/internal';
import { NumberInput } from 'app/core/components/OptionsUI/NumberInput';
import { t } from 'app/core/internationalization';

import { getTransformationContent } from '../docs/getTransformationContent';

import { DEFAULTS, ModelType, RegressionTransformer, RegressionTransformerOptions } from './regression';

const fieldNamePickerSettings = {
  editor: FieldNamePicker,
  id: '',
  name: '',
  settings: { width: 24, isClearable: false },
};

const LABEL_WIDTH = 20;

export const RegressionTransformerEditor = ({
  input,
  options,
  onChange,
}: TransformerUIProps<RegressionTransformerOptions>) => {
  const modelTypeOptions = [
    { label: 'Linear', value: ModelType.linear },
    { label: 'Polynomial', value: ModelType.polynomial },
  ];

  useEffect(() => {
    let x: Field | undefined;
    let y: Field | undefined;
    if (!options.xFieldName) {
      const timeMatcher = fieldMatchers.get(FieldMatcherID.firstTimeField).get({});
      for (const frame of input) {
        x = frame.fields.find((field) => timeMatcher(field, frame, input));
        if (x) {
          break;
        }
      }
      if (!x) {
        const firstMatcher = fieldMatchers.get(FieldMatcherID.numeric).get({});
        for (const frame of input) {
          x = frame.fields.find((field) => firstMatcher(field, frame, input));
          if (x) {
            break;
          }
        }
      }
    }
    if (!options.yFieldName) {
      const numberMatcher = fieldMatchers.get(FieldMatcherID.numeric).get({});
      for (const frame of input) {
        y = frame.fields.find((field) => numberMatcher(field, frame, input) && field !== x);
        if (y) {
          break;
        }
      }
    }

    if (x && y) {
      onChange({ ...options, xFieldName: x.name, yFieldName: y.name });
    }
  });

  return (
    <>
      <InlineField
        labelWidth={LABEL_WIDTH}
        label={t('transformers.regression-transformer-editor.label-x-field', 'X field')}
      >
        <FieldNamePicker
          context={{ data: input }}
          value={options.xFieldName ?? ''}
          item={fieldNamePickerSettings}
          onChange={(v) => {
            onChange({ ...options, xFieldName: v });
          }}
        ></FieldNamePicker>
      </InlineField>
      <InlineField
        labelWidth={LABEL_WIDTH}
        label={t('transformers.regression-transformer-editor.label-y-field', 'Y field')}
      >
        <FieldNamePicker
          context={{ data: input }}
          value={options.yFieldName ?? ''}
          item={fieldNamePickerSettings}
          onChange={(v) => {
            onChange({ ...options, yFieldName: v });
          }}
        ></FieldNamePicker>
      </InlineField>
      <InlineField
        labelWidth={LABEL_WIDTH}
        label={t('transformers.regression-transformer-editor.label-model-type', 'Model type')}
      >
        <Select
          value={options.modelType ?? DEFAULTS.modelType}
          onChange={(v) => {
            onChange({ ...options, modelType: v.value ?? DEFAULTS.modelType });
          }}
          options={modelTypeOptions}
        ></Select>
      </InlineField>
      <InlineField
        labelWidth={LABEL_WIDTH}
        label={t('transformers.regression-transformer-editor.label-predicted-points', 'Predicted points')}
        tooltip={t(
          'transformers.regression-transformer-editor.tooltip-number-of-xy-points-to-predict',
          'Number of X,Y points to predict'
        )}
      >
        <NumberInput
          value={options.predictionCount ?? DEFAULTS.predictionCount}
          onChange={(v) => {
            onChange({ ...options, predictionCount: v });
          }}
        ></NumberInput>
      </InlineField>
      {options.modelType === ModelType.polynomial && (
        <InlineField
          labelWidth={LABEL_WIDTH}
          label={t('transformers.regression-transformer-editor.label-degree', 'Degree')}
        >
          <Select<number>
            value={options.degree ?? DEFAULTS.degree}
            options={[
              { label: 'Quadratic', value: 2 },
              { label: 'Cubic', value: 3 },
              { label: 'Quartic', value: 4 },
              { label: 'Quintic', value: 5 },
            ]}
            onChange={(v) => {
              onChange({ ...options, degree: v.value });
            }}
          ></Select>
        </InlineField>
      )}
    </>
  );
};

export const regressionTransformerRegistryItem: TransformerRegistryItem<RegressionTransformerOptions> = {
  id: DataTransformerID.regression,
  editor: RegressionTransformerEditor,
  transformation: RegressionTransformer,
  name: RegressionTransformer.name,
  description: RegressionTransformer.description,
  categories: new Set([TransformerCategory.CalculateNewFields]),
  help: getTransformationContent(DataTransformerID.regression).helperDocs,
};
