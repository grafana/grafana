import { useRef, useState } from 'react';

import { SelectableValue, StandardEditorProps, VariableOrigin } from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';
import { HeatmapCalculationBucketConfig, HeatmapCalculationMode } from '@grafana/schema';
import { HorizontalGroup, RadioButtonGroup, ScaleDistribution } from '@grafana/ui';

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

export const AxisEditor = ({ value, onChange, item }: StandardEditorProps<HeatmapCalculationBucketConfig>) => {
  const [isInvalid, setInvalid] = useState<boolean>(false);

  const modeSwitchCounter = useRef(0);

  const allowInterval = item.settings?.allowInterval ?? false;

  const onValueChange = ({ mode, scale, value = '' }: HeatmapCalculationBucketConfig) => {
    let isValid = true;

    if (mode !== HeatmapCalculationMode.Count) {
      if (!allowInterval) {
        isValid = numberOrVariableValidator(value);
      } else if (value !== '') {
        let durationMS = convertDurationToMilliseconds(value);
        if (durationMS === undefined) {
          isValid = false;
        }
      }
    }

    setInvalid(!isValid);
    onChange({ mode, scale, value });
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
          modeSwitchCounter.current++;

          onValueChange({
            ...value,
            value: '',
            mode,
          });
        }}
      />
      <SuggestionsInput
        // we need this cause the value prop is not changeable after init
        // so we have to re-create the component during mode switches to reset the value to auto
        key={modeSwitchCounter.current}
        invalid={isInvalid}
        error={'Value needs to be an integer or a variable'}
        value={value?.value ?? ''}
        placeholder="Auto"
        onChange={(text) => {
          onValueChange({ ...value, value: text });
        }}
        suggestions={variables}
      />
    </HorizontalGroup>
  );
};
