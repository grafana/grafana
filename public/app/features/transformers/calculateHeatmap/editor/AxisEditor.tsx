import { useState } from 'react';

import { SelectableValue, StandardEditorProps, VariableOrigin } from '@grafana/data';
import { getTemplateSrv, config as cfg } from '@grafana/runtime';
import { HeatmapCalculationBucketConfig, HeatmapCalculationMode } from '@grafana/schema';
import { HorizontalGroup, Input, RadioButtonGroup, ScaleDistribution } from '@grafana/ui';

import { SuggestionsInput } from '../../suggestionsInput/SuggestionsInput';
import { numberOrVariableValidator } from '../../utils';
import { convertDurationToMilliseconds } from '../utils';

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

const X_BINS_MAX = 3840; // 4k display width

export const AxisEditor = ({ value, onChange, item }: StandardEditorProps<HeatmapCalculationBucketConfig>) => {
  const [isInvalid, setInvalid] = useState<boolean>(false);
  const [isBucketQtyInvalid, setBucketQtyInvalid] = useState<boolean>(false);
  const mode = value?.mode || HeatmapCalculationMode.Size;

  const allowInterval = item.settings?.allowInterval ?? false;

  const onValueChange = (bucketValue: string) => {
    let isValid = true;
    if (!allowInterval) {
      isValid = numberOrVariableValidator(bucketValue);
      setBucketQtyInvalid(false);
    } else if (bucketValue !== '') {
      let durationMS = convertDurationToMilliseconds(bucketValue);
      if (durationMS === undefined) {
        isValid = false;
        setBucketQtyInvalid(false);
      } else if (item.settings.timeRange && mode === HeatmapCalculationMode.Size) {
        const xMin = item.settings.timeRange.from.valueOf();
        const xMax = item.settings.timeRange.to.valueOf();
        const numBins = Math.round((xMax - xMin) / durationMS);

        if (numBins > X_BINS_MAX) {
          isValid = false;
          setBucketQtyInvalid(true);
        } else {
          setBucketQtyInvalid(false);
        }
      } else {
        setBucketQtyInvalid(false);
      }
    } else {
      setBucketQtyInvalid(false);
    }

    setInvalid(!isValid);
    onChange({
      ...value,
      value: bucketValue,
      valid: isValid,
    });
  };

  const templateSrv = getTemplateSrv();
  const variables = templateSrv.getVariables().map((v) => {
    return { value: v.name, label: v.label || v.name, origin: VariableOrigin.Template };
  });

  const errorMsg = allowInterval
    ? isBucketQtyInvalid
      ? 'Value generates too many buckets. Please choose a larger interval.'
      : isInvalid
        ? 'Value needs to be an duration or a variable'
        : ''
    : 'Value needs to be an integer or a variable';

  return (
    <HorizontalGroup>
      <RadioButtonGroup
        value={mode}
        options={value?.scale?.type === ScaleDistribution.Log ? logModeOptions : modeOptions}
        onChange={(mode) => {
          onChange({
            ...value,
            mode,
          });
        }}
      />
      {cfg.featureToggles.transformationsVariableSupport ? (
        <SuggestionsInput
          invalid={isInvalid || isBucketQtyInvalid}
          error={errorMsg}
          value={value?.value ?? ''}
          placeholder="Auto"
          onChange={onValueChange}
          suggestions={variables}
        />
      ) : (
        <Input
          value={value?.value ?? ''}
          placeholder="Auto"
          onChange={(v) => {
            onChange({
              ...value,
              value: v.currentTarget.value,
            });
          }}
        />
      )}
    </HorizontalGroup>
  );
};
