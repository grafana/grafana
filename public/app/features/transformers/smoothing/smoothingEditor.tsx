import { css } from '@emotion/css';
import { useMemo } from 'react';

import { type TransformerUIProps } from '@grafana/data';
import { t } from '@grafana/i18n';
import { InlineField, InlineFieldRow, Tooltip, useTheme2 } from '@grafana/ui';
import { NumberInput } from 'app/core/components/OptionsUI/NumberInput';

import {
  DEFAULTS,
  RESOLUTION_LIMITS,
  type SmoothingTransformerOptions,
  calculateEffectiveResolution,
  calculateMaxSourcePoints,
} from './smoothing';

export const SmoothingTransformerEditor = ({
  input,
  options,
  onChange,
}: TransformerUIProps<SmoothingTransformerOptions>) => {
  const theme = useTheme2();
  const resolution = options.resolution ?? DEFAULTS.resolution;

  const maxSourcePoints = useMemo(() => calculateMaxSourcePoints(input), [input]);
  const effectiveResolution = maxSourcePoints > 0 ? calculateEffectiveResolution(resolution, maxSourcePoints) : null;
  const showEffectiveResolution = effectiveResolution !== null && effectiveResolution < resolution;

  return (
    <InlineFieldRow>
      <InlineField
        label={t('transformers.smoothing.resolution.label', 'Resolution')}
        labelWidth={12}
        tooltip={t(
          'transformers.smoothing.resolution.tooltip',
          'Controls smoothing intensity. Lower values create more aggressive smoothing. Both original and smoothed data are displayed.'
        )}
      >
        <NumberInput
          value={resolution}
          onChange={(v) => onChange({ ...options, resolution: v })}
          min={RESOLUTION_LIMITS.min}
          max={RESOLUTION_LIMITS.max}
          width={20}
          suffix={
            showEffectiveResolution ? (
              <Tooltip
                content={t(
                  'transformers.smoothing.effective-resolution-tooltip',
                  'Resolution is limited to 2× the number of data points ({{points}}).',
                  { points: maxSourcePoints }
                )}
              >
                <span
                  className={css({
                    marginLeft: '8px',
                    color: theme.colors.text.secondary,
                    fontSize: theme.typography.bodySmall.fontSize,
                  })}
                >
                  {t('transformers.smoothing.effective-resolution', 'Effective: {{value}}', {
                    value: effectiveResolution,
                  })}
                </span>
              </Tooltip>
            ) : undefined
          }
        />
      </InlineField>
    </InlineFieldRow>
  );
};
