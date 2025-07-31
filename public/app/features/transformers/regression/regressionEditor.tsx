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
import { t } from '@grafana/i18n';
import { Combobox, InlineField } from '@grafana/ui';
import { FieldNamePicker } from '@grafana/ui/internal';
import { NumberInput } from 'app/core/components/OptionsUI/NumberInput';

import { getTransformationContent } from '../docs/getTransformationContent';
import darkImage from '../images/dark/regression.svg';
import lightImage from '../images/light/regression.svg';

import { DEFAULTS, DEGREES, ModelType, getRegressionTransformer, RegressionTransformerOptions } from './regression';

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
    {
      label: t('transformers.regression-transformer-editor.model-type-options.label.linear', 'Linear'),
      value: ModelType.linear,
    },
    {
      label: t('transformers.regression-transformer-editor.model-type-options.label.polynomial', 'Polynomial'),
      value: ModelType.polynomial,
    },
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
        />
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
        />
      </InlineField>
      <InlineField
        labelWidth={LABEL_WIDTH}
        label={t('transformers.regression-transformer-editor.label-model-type', 'Model type')}
      >
        <Combobox
          value={options.modelType ?? DEFAULTS.modelType}
          onChange={(v) => {
            onChange({ ...options, modelType: v.value ?? DEFAULTS.modelType });
          }}
          options={modelTypeOptions}
        />
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
        />
      </InlineField>
      {options.modelType === ModelType.polynomial && (
        <InlineField
          labelWidth={LABEL_WIDTH}
          label={t('transformers.regression-transformer-editor.label-degree', 'Degree')}
          tooltip={t(
            'transformers.regression-transformer-editor.tooltip-high-degree-polynomial',
            'Higher-degree polynomials (e.g., degree 4 or higher) can result in misleading trends and unstable fits. Proceed with caution.'
          )}
        >
          <Combobox
            value={options.degree ?? DEFAULTS.degree}
            options={DEGREES.map((deg) => {
              return {
                label: deg.label(),
                value: deg.value,
              };
            })}
            onChange={(v) => {
              onChange({ ...options, degree: Number(v.value) });
            }}
          />
        </InlineField>
      )}
    </>
  );
};

export const getRegressionTransformerRegistryItem: () => TransformerRegistryItem<RegressionTransformerOptions> = () => {
  const regressionTransformer = getRegressionTransformer();
  return {
    id: DataTransformerID.regression,
    editor: RegressionTransformerEditor,
    transformation: regressionTransformer,
    name: regressionTransformer.name,
    description: regressionTransformer.description,
    categories: new Set([TransformerCategory.CalculateNewFields]),
    help: getTransformationContent(DataTransformerID.regression).helperDocs,
    imageDark: darkImage,
    imageLight: lightImage,
    tags: new Set([t('transformers.regression-transformer-editor.tags.regression-analysis', 'Regression analysis')]),
  };
};
