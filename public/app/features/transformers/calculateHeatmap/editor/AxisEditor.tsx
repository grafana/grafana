import { useState } from 'react';

import {
  SelectableValue,
  StandardEditorProps,
  VariableOrigin,
  durationToMilliseconds,
  isValidDuration,
  parseDuration,
} from '@grafana/data';
import { getTemplateSrv, config as cfg } from '@grafana/runtime';
import { HeatmapCalculationBucketConfig, HeatmapCalculationMode } from '@grafana/schema';
import { HorizontalGroup, Input, RadioButtonGroup, ScaleDistribution } from '@grafana/ui';

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
  const [isBucketQtyInvalid, setBucketQtyInvalid] = useState<boolean>(false);
  const mode = value?.mode || HeatmapCalculationMode.Size;

  const allowInterval = item.settings?.allowInterval ?? false;

  const onValueChange = (bucketValue: string) => {
    if (!allowInterval) {
      setInvalid(!numberOrVariableValidator(bucketValue));
      setBucketQtyInvalid(false);
    } else {
      const isValidBucketDuration = isValidDuration(bucketValue);
      const isValidNumberOrVariable = numberOrVariableValidator(bucketValue);
      const isInvalid = !isValidBucketDuration && !isValidNumberOrVariable;
      setInvalid(isInvalid);

      if (item.settings.timeRange && mode === HeatmapCalculationMode.Size && !isInvalid) {
        const xBinIncr = durationToMilliseconds(parseDuration(bucketValue));
        const xMin = item.settings.timeRange.from.valueOf();
        const xMax = item.settings.timeRange.to.valueOf();
        const numBins = Math.round((xMax - xMin) / xBinIncr);
        if (numBins > 10000) {
          setBucketQtyInvalid(true);
        } else {
          setBucketQtyInvalid(false);
        }
      } else {
        setBucketQtyInvalid(false);
      }
    }

    onChange({
      ...value,
      value: bucketValue,
    });
  };

  const templateSrv = getTemplateSrv();
  const variables = templateSrv.getVariables().map((v) => {
    return { value: v.name, label: v.label || v.name, origin: VariableOrigin.Template };
  });

  const errorMsg = allowInterval
    ? isInvalid
      ? 'Value needs to be an duration or a variable'
      : isBucketQtyInvalid
        ? 'Value generates too many buckets. Please choose a larger interval.'
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
