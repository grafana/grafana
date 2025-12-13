import { useState } from 'react';

import { SelectableValue, StandardEditorProps } from '@grafana/data';
import { t } from '@grafana/i18n';
import { ScaleDistribution, ScaleDistributionConfig } from '@grafana/schema';
import { RadioButtonGroup, Field, Select, Input } from '@grafana/ui';

type ScaleOptionValue = 'auto' | ScaleDistribution;

/**
 * Simplified scale editor that shows all options in a single line.
 * Includes "Auto" option which returns undefined to use default behavior.
 */
export const YBucketScaleEditor = (props: StandardEditorProps<ScaleDistributionConfig | undefined>) => {
  const { value, onChange } = props;

  const type = value?.type;
  const log = value?.log ?? 2;
  const isAuto = value === undefined;

  const [localLinearThreshold, setLocalLinearThreshold] = useState<string>(
    value?.linearThreshold != null ? String(value.linearThreshold) : ''
  );

  const currentOption: ScaleOptionValue = isAuto ? 'auto' : type!;
  const showLogBase = type === ScaleDistribution.Log || type === ScaleDistribution.Symlog;
  const showLinearThreshold = type === ScaleDistribution.Symlog;

  const SCALE_OPTIONS: Array<SelectableValue<ScaleOptionValue>> = [
    {
      label: t('heatmap.y-bucket-scale-editor.scale-options.label-auto', 'Auto'),
      value: 'auto',
    },
    {
      label: t('heatmap.y-bucket-scale-editor.scale-options.label-linear', 'Linear'),
      value: ScaleDistribution.Linear,
    },
    {
      label: t('heatmap.y-bucket-scale-editor.scale-options.label-log', 'Log'),
      value: ScaleDistribution.Log,
    },
    {
      label: t('heatmap.y-bucket-scale-editor.scale-options.label-symlog', 'Symlog'),
      value: ScaleDistribution.Symlog,
    },
  ];

  const LOG_BASE_OPTIONS: Array<SelectableValue<number>> = [
    {
      label: '2',
      value: 2,
    },
    {
      label: '10',
      value: 10,
    },
  ];

  const handleScaleChange = (v: ScaleOptionValue) => {
    if (v === 'auto') {
      onChange(undefined);
      return;
    }

    if (v === ScaleDistribution.Linear) {
      onChange({ type: ScaleDistribution.Linear });
      return;
    }

    if (v === ScaleDistribution.Log) {
      onChange({ type: ScaleDistribution.Log, log });
      return;
    }

    if (v === ScaleDistribution.Symlog) {
      onChange({
        type: ScaleDistribution.Symlog,
        log,
        linearThreshold: value?.linearThreshold ?? 1,
      });
      return;
    }
  };

  const handleLogBaseChange = (newLog: number) => {
    onChange({
      ...value!,
      log: newLog,
    });
  };

  const handleLinearThresholdChange = (newValue: string) => {
    setLocalLinearThreshold(newValue);
    const numValue = parseFloat(newValue);
    if (!isNaN(numValue) && numValue !== 0) {
      onChange({
        ...value!,
        linearThreshold: numValue,
      });
    }
  };

  return (
    <>
      <RadioButtonGroup value={currentOption} options={SCALE_OPTIONS} onChange={handleScaleChange} fullWidth />
      {showLogBase && (
        <Field
          label={t('heatmap.y-bucket-scale-editor.log-base-label', 'Log base')}
          style={{ marginTop: '8px' }}
          noMargin
        >
          <Select options={LOG_BASE_OPTIONS} value={log} onChange={(v) => handleLogBaseChange(v.value!)} />
        </Field>
      )}
      {showLinearThreshold && (
        <Field
          label={t('heatmap.y-bucket-scale-editor.linear-threshold-label', 'Linear threshold')}
          description={t(
            'heatmap.y-bucket-scale-editor.linear-threshold-description',
            'Range within which the scale is linear'
          )}
          style={{ marginTop: '8px' }}
          noMargin
        >
          <Input
            type="number"
            value={localLinearThreshold}
            onChange={(e) => handleLinearThresholdChange(e.currentTarget.value)}
            placeholder={t('heatmap.y-bucket-scale-editor.linear-threshold-placeholder', '1')}
          />
        </Field>
      )}
    </>
  );
};
