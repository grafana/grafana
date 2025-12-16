import { DataTransformerID, TransformerRegistryItem, TransformerUIProps, TransformerCategory } from '@grafana/data';
import { t } from '@grafana/i18n';
import { InlineField, InlineFieldRow } from '@grafana/ui';
import { NumberInput } from 'app/core/components/OptionsUI/NumberInput';

import { getTransformationContent } from '../docs/getTransformationContent';
import darkImage from '../images/dark/smoothing.svg';
import lightImage from '../images/light/smoothing.svg';

import { DEFAULTS, RESOLUTION_LIMITS, SmoothingTransformerOptions, getSmoothingTransformer } from './smoothing';

export const SmoothingTransformerEditor = ({
  input,
  options,
  onChange,
}: TransformerUIProps<SmoothingTransformerOptions>) => {
  return (
    <InlineFieldRow>
      <InlineField
        label={t('transformers.smoothing.resolution.label', 'Resolution')}
        labelWidth={12}
        tooltip={t(
          'transformers.smoothing.resolution.tooltip',
          'Controls smoothing intensity. Lower values create more aggressive smoothing. The output preserves all original time points.'
        )}
      >
        <NumberInput
          value={options.resolution ?? DEFAULTS.resolution}
          onChange={(v) => onChange({ ...options, resolution: v })}
          min={RESOLUTION_LIMITS.min}
          max={RESOLUTION_LIMITS.max}
          width={20}
        />
      </InlineField>
    </InlineFieldRow>
  );
};

export const getSmoothingTransformerRegistryItem: () => TransformerRegistryItem<SmoothingTransformerOptions> = () => {
  const smoothingTransformer = getSmoothingTransformer();
  return {
    id: DataTransformerID.smoothing,
    editor: SmoothingTransformerEditor,
    transformation: smoothingTransformer,
    name: smoothingTransformer.name,
    description: smoothingTransformer.description,
    categories: new Set([TransformerCategory.CalculateNewFields]),
    imageDark: darkImage,
    imageLight: lightImage,
    help: getTransformationContent(DataTransformerID.smoothing).helperDocs,
  };
};
