import { css } from '@emotion/css';
import React, { useState } from 'react';

import { SelectableValue, StandardEditorProps, VariableOrigin } from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';
import { HeatmapCalculationBucketConfig, HeatmapCalculationMode } from '@grafana/schema';
import { Field, HorizontalGroup, RadioButtonGroup, ScaleDistribution } from '@grafana/ui';

import { SuggestionsInput } from '../../suggestionsInput/SuggestionsInput';
import { numberOrVariableValidator } from '../../utils';

const modeOptions: Array<SelectableValue<HeatmapCalculationMode>> = [
  {
    label: 'Size',
    value: HeatmapCalculationMode.Size,
    description: 'Split the buckets based on size',
  },
  {
    label: 'Count',
    value: HeatmapCalculationMode.Count,
    description: 'Split the buckets based on count',
  },
];

const logModeOptions: Array<SelectableValue<HeatmapCalculationMode>> = [
  {
    label: 'Split',
    value: HeatmapCalculationMode.Size,
    description: 'Split the buckets based on size',
  },
];

export const AxisEditor = ({ value, onChange, item }: StandardEditorProps<HeatmapCalculationBucketConfig>) => {
  const [isInvalid, setInvalid] = useState<boolean>(false);

  const onValueChange = (bucketValue: string) => {
    setInvalid(!numberOrVariableValidator(bucketValue));
    onChange({
      ...value,
      value: bucketValue,
    });
  };

  const templateSrv = getTemplateSrv();
  const variables = templateSrv.getVariables().map((v) => {
    return { value: v.name, label: v.label || v.name, origin: VariableOrigin.Template };
  });

  return (
    <HorizontalGroup>
      <RadioButtonGroup
        value={value?.mode || HeatmapCalculationMode.Size}
        options={value?.scale?.type === ScaleDistribution.Log ? logModeOptions : modeOptions}
        onChange={(mode) => {
          onChange({
            ...value,
            mode,
          });
        }}
      />
      {/* TODO: Still needs some tweaks */}
      <Field
        invalid={isInvalid}
        error={'Value needs to be an integer or a variable'}
        className={css({ width: '100px', margin: 0 })}
      >
        <SuggestionsInput
          invalid={isInvalid}
          value={value?.value ?? ''}
          placeholder="Auto"
          onChange={onValueChange}
          suggestions={variables}
          width={150}
        />
      </Field>
    </HorizontalGroup>
  );
};
