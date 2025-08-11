import { ReactElement, useEffect, useMemo } from 'react';

import {
  DataTransformerID,
  TransformerRegistryItem,
  TransformerUIProps,
  TransformerCategory,
  Field,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import { Combobox, InlineField } from '@grafana/ui';
import { FieldNamePicker } from '@grafana/ui/internal';
import { NumberInput } from 'app/core/components/OptionsUI/NumberInput';

import { getTransformationContent } from '../docs/getTransformationContent';
import darkImage from '../images/dark/regression.svg';
import lightImage from '../images/light/regression.svg';

import { FIELD_MATCHERS, LABEL_WIDTH, fieldNamePickerSettings, getModelTypeOptions } from './constants';
import { DEFAULTS, DEGREES, ModelType, getRegressionTransformer, RegressionTransformerOptions } from './regression';
import { findFirstFieldByMatcher } from './utils';

export const RegressionTransformerEditor = ({
  input,
  options,
  onChange,
}: TransformerUIProps<RegressionTransformerOptions>) => {
  const modelTypeOptions = useMemo(() => getModelTypeOptions(), []);
  const degreeOptions = useMemo(
    () =>
      DEGREES.map((deg) => {
        return {
          label: deg.label(),
          value: deg.value,
        };
      }),
    []
  );

  // Auto-select default X and Y fields when they're not explicitly set by the user.
  // This provides better UX when adding a new regression transform by automatically
  // choosing sensible defaults: time field (or numeric fallback) for X, and a different
  // numeric field for Y. Only runs when fields are missing due to early return optimization.
  useEffect(() => {
    let x: Field | undefined;
    let y: Field | undefined;

    // Both fields already selected, nothing to do, early return
    if (options.xFieldName && options.yFieldName) {
      return;
    }

    if (!options.xFieldName) {
      x =
        findFirstFieldByMatcher(input, FIELD_MATCHERS.firstTimeMatcher) ||
        findFirstFieldByMatcher(input, FIELD_MATCHERS.numericMatcher);
    }
    if (!options.yFieldName) {
      y = findFirstFieldByMatcher(input, FIELD_MATCHERS.numericMatcher, x);
    }

    if (x && y) {
      onChange({ ...options, xFieldName: x.name, yFieldName: y.name });
    }
  }, [input, options, onChange]);

  return (
    <>
      <RegressionField label={t('transformers.regression-transformer-editor.label-x-field', 'X field')}>
        <FieldNamePicker
          context={{ data: input }}
          value={options.xFieldName ?? ''}
          item={fieldNamePickerSettings}
          onChange={(v) => onChange({ ...options, xFieldName: v })}
        />
      </RegressionField>
      <RegressionField label={t('transformers.regression-transformer-editor.label-y-field', 'Y field')}>
        <FieldNamePicker
          context={{ data: input }}
          value={options.yFieldName ?? ''}
          item={fieldNamePickerSettings}
          onChange={(v) => onChange({ ...options, yFieldName: v })}
        />
      </RegressionField>
      <RegressionField label={t('transformers.regression-transformer-editor.label-model-type', 'Model type')}>
        <Combobox
          value={options.modelType ?? DEFAULTS.modelType}
          onChange={(v) => onChange({ ...options, modelType: v.value ?? DEFAULTS.modelType })}
          options={modelTypeOptions}
        />
      </RegressionField>
      <RegressionField
        label={t('transformers.regression-transformer-editor.label-predicted-points', 'Predicted points')}
        tooltip={t(
          'transformers.regression-transformer-editor.tooltip-number-of-xy-points-to-predict',
          'Number of X,Y points to predict'
        )}
      >
        <NumberInput
          value={options.predictionCount ?? DEFAULTS.predictionCount}
          onChange={(v) => onChange({ ...options, predictionCount: v })}
        />
      </RegressionField>
      {options.modelType === ModelType.polynomial && (
        <RegressionField
          label={t('transformers.regression-transformer-editor.label-degree', 'Degree')}
          tooltip={t(
            'transformers.regression-transformer-editor.tooltip-high-degree-polynomial',
            'Higher-degree polynomials (e.g., degree 4 or higher) can result in misleading trends and unstable fits. Proceed with caution.'
          )}
        >
          <Combobox
            value={options.degree ?? DEFAULTS.degree}
            options={degreeOptions}
            onChange={(v) => onChange({ ...options, degree: Number(v.value) })}
          />
        </RegressionField>
      )}
    </>
  );
};

const RegressionField = ({ label, tooltip, children }: { label: string; tooltip?: string; children: ReactElement }) => (
  <InlineField labelWidth={LABEL_WIDTH} label={label} tooltip={tooltip}>
    {children}
  </InlineField>
);

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
