import { type SelectableValue, type StandardEditorProps } from '@grafana/data';
import { t } from '@grafana/i18n';
import { ScaleDistribution, type ScaleDistributionConfig } from '@grafana/schema';
import { RadioButtonGroup } from '@grafana/ui';

export const GaugeScaleEditor = ({
  value,
  onChange,
}: Pick<StandardEditorProps<ScaleDistributionConfig | undefined>, 'value' | 'onChange'>) => {
  const options: Array<SelectableValue<ScaleDistribution>> = [
    { label: t('stat.gauge-scale-editor.label-linear', 'Linear'), value: ScaleDistribution.Linear },
    { label: t('stat.gauge-scale-editor.label-log', 'Logarithmic'), value: ScaleDistribution.Log },
  ];

  return (
    <RadioButtonGroup
      value={value?.type === ScaleDistribution.Log ? ScaleDistribution.Log : ScaleDistribution.Linear}
      options={options}
      onChange={(type) => onChange({ type })}
    />
  );
};
