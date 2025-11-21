import { SelectableValue, StandardEditorProps } from '@grafana/data';
import { t } from '@grafana/i18n';
import { ScaleDistribution, ScaleDistributionConfig } from '@grafana/schema';
import { RadioButtonGroup } from '@grafana/ui';
import { ScaleDistributionEditor } from '@grafana/ui/internal';

/**
 * Wrapper around ScaleDistributionEditor that adds an "Auto" option.
 * When "Auto" is selected, returns undefined to use default behavior.
 */
export const YBucketScaleEditor = (props: StandardEditorProps<ScaleDistributionConfig | undefined>) => {
  const { value, onChange, context, item } = props;
  const isAuto = value === undefined;

  const SCALE_OPTIONS: Array<SelectableValue<'auto' | 'manual'>> = [
    {
      label: t('heatmap.y-bucket-scale-editor.scale-options.label-auto', 'Auto'),
      value: 'auto',
    },
    {
      label: t('heatmap.y-bucket-scale-editor.scale-options.label-manual', 'Manual'),
      value: 'manual',
    },
  ];

  return (
    <>
      <RadioButtonGroup
        value={isAuto ? 'auto' : 'manual'}
        options={SCALE_OPTIONS}
        onChange={(v) => {
          if (v === 'auto') {
            onChange(undefined);
          } else {
            // Initialize with Linear when switching from Auto to Manual
            onChange(value ?? { type: ScaleDistribution.Linear });
          }
        }}
        fullWidth={false}
      />
      {!isAuto && (
        <div style={{ marginTop: '8px' }}>
          <ScaleDistributionEditor
            value={value ?? { type: ScaleDistribution.Linear }}
            onChange={onChange}
            context={context}
            item={item}
          />
        </div>
      )}
    </>
  );
};
