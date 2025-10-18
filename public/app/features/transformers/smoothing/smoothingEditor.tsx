import { DataTransformerID, TransformerRegistryItem, TransformerUIProps, TransformerCategory } from '@grafana/data';
import { t } from '@grafana/i18n';
import { InlineField, InlineFieldRow } from '@grafana/ui';
import { NumberInput } from 'app/core/components/OptionsUI/NumberInput';

import { getTransformationContent } from '../docs/getTransformationContent';
import darkImage from '../images/dark/smoothing.svg';
import lightImage from '../images/light/smoothing.svg';

import { DEFAULTS, SmoothingTransformerOptions, getSmoothingTransformer } from './smoothing';

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
          'Number of points in the smoothed output. Lower values create more aggressive smoothing with fewer points.'
        )}
      >
        <NumberInput
          value={options.resolution ?? DEFAULTS.resolution}
          onChange={(v) => onChange({ ...options, resolution: v })}
          min={10}
          max={1000}
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
    categories: new Set([TransformerCategory.Reformat]),
    imageDark: darkImage,
    imageLight: lightImage,
    help: getTransformationContent(DataTransformerID.smoothing).helperDocs,
  };
};
