import { css } from '@emotion/css';
import { useId, useMemo, useState } from 'react';

import { formattedValueToString, type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';

import { useStyles2, useTheme2 } from '../../../../themes/ThemeContext';
import { Input } from '../../../Input/Input';
import { Box } from '../../../Layout/Box/Box';
import { Stack } from '../../../Layout/Stack/Stack';
import { RangeSliderG14 } from '../../../Slider/RangeSliderG14';

import { RangeFilterFrame, useRangeInputFocus } from './RangeFilterFrame';
import { type RangeFilterProps } from './rangeFilterTypes';
import { rangeValidation, sliderBoundText, sliderDecimals, useRangeValues } from './utils';

const rangeSelectors = selectors.components.Panels.Visualization.TableNG.Filters.Range;

export function NumericRangeFilter({ field, rows, range, onApply, onClear, onCancel }: RangeFilterProps) {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);
  const id = useId();
  const validationId = useId();
  const minimumRef = useRangeInputFocus();
  const [lower, setLower] = useState(() => (range?.min == null ? '' : String(range.min)));
  const [upper, setUpper] = useState(() => (range?.max == null ? '' : String(range.max)));
  const { values, histogram } = useRangeValues(field, rows);
  const sliderRange = histogram.max - histogram.min;
  const decimals = useMemo(
    () => sliderDecimals(field, histogram.finite, sliderRange),
    [field, histogram.finite, sliderRange]
  );
  const sliderStep = Math.max(sliderRange / 1000, 10 ** -decimals);
  const parse = (value: string) => (value.trim() === '' ? undefined : Number(value));
  const min = parse(lower);
  const max = parse(upper);
  const sliderMin = Math.max(
    histogram.min,
    Math.min(histogram.max, min != null && Number.isFinite(min) ? min : histogram.min)
  );
  const sliderMax = Math.max(
    histogram.min,
    Math.min(histogram.max, max != null && Number.isFinite(max) ? max : histogram.max)
  );
  const { minimumInvalid, maximumInvalid, boundsReversed, invalid } = rangeValidation(min, max);
  const formatValue = (value: number) => (field.display ? formattedValueToString(field.display(value)) : String(value));
  const maxCount = Math.max(1, ...histogram.bins);
  const minimumLabel = t('grafana-ui.table.range.minimum', 'Minimum');
  const maximumLabel = t('grafana-ui.table.range.maximum', 'Maximum');

  return (
    <RangeFilterFrame
      field={field}
      values={values}
      finite={histogram.finite}
      min={min}
      max={max}
      invalid={invalid}
      validationId={validationId}
      range={range}
      onApply={onApply}
      onClear={onClear}
      onCancel={onCancel}
    >
      {histogram.bins.length > 0 ? (
        <>
          <svg
            className={styles.histogram}
            data-testid={rangeSelectors.histogram}
            viewBox="0 0 300 80"
            preserveAspectRatio="none"
            role="img"
            aria-label={t('grafana-ui.table.range.histogram', 'Value distribution, {{amount}} finite values', {
              amount: histogram.finite.length,
            })}
          >
            {histogram.bins.map((count, index) => {
              const from = histogram.min + (index / histogram.bins.length) * (histogram.max - histogram.min);
              const to = histogram.min + ((index + 1) / histogram.bins.length) * (histogram.max - histogram.min);
              const selected = !invalid && (max == null || from <= max) && (min == null || to >= min);
              const height = (count / maxCount) * 76;
              return (
                <rect
                  key={index}
                  x={(index * 300) / histogram.bins.length}
                  y={80 - height}
                  width={Math.max(1, 300 / histogram.bins.length - 1)}
                  height={height}
                  fill={selected ? theme.colors.primary.main : theme.colors.border.medium}
                >
                  <title>
                    {formatValue(from)} – {formatValue(to)}: {count}
                  </title>
                </rect>
              );
            })}
          </svg>
          {histogram.min !== histogram.max && (
            <Box paddingRight={1}>
              <RangeSliderG14
                min={histogram.min}
                max={histogram.max}
                value={[sliderMin, sliderMax]}
                step={sliderStep}
                tooltipAlwaysVisible={false}
                ariaLabelForHandle={[minimumLabel, maximumLabel]}
                formatTooltipResult={(value) => formatValue(Number(value.toFixed(decimals)))}
                onChange={([min, max]) => {
                  setLower(sliderBoundText(min, sliderMin, lower, decimals));
                  setUpper(sliderBoundText(max, sliderMax, upper, decimals));
                }}
              />
            </Box>
          )}
          <Stack justifyContent="space-between">
            <span>{formatValue(histogram.min)}</span>
            <span>{formatValue(histogram.max)}</span>
          </Stack>
        </>
      ) : (
        <div>{t('grafana-ui.table.range.empty', 'No finite values match the other filters.')}</div>
      )}
      <Stack gap={1}>
        <Stack direction="column" gap={0.5} grow={1} minWidth={0}>
          <label htmlFor={`${id}-min`}>{minimumLabel}</label>
          <Input
            id={`${id}-min`}
            ref={minimumRef}
            data-testid={rangeSelectors.minimumInput}
            type="text"
            inputMode="decimal"
            value={lower}
            placeholder={t('grafana-ui.table.range.unbounded', 'No limit')}
            invalid={minimumInvalid || boundsReversed}
            aria-describedby={minimumInvalid || boundsReversed ? validationId : undefined}
            onChange={(event) => setLower(event.currentTarget.value)}
          />
        </Stack>
        <Stack direction="column" gap={0.5} grow={1} minWidth={0}>
          <label htmlFor={`${id}-max`}>{maximumLabel}</label>
          <Input
            id={`${id}-max`}
            data-testid={rangeSelectors.maximumInput}
            type="text"
            inputMode="decimal"
            value={upper}
            placeholder={t('grafana-ui.table.range.unbounded', 'No limit')}
            invalid={maximumInvalid || boundsReversed}
            aria-describedby={maximumInvalid || boundsReversed ? validationId : undefined}
            onChange={(event) => setUpper(event.currentTarget.value)}
          />
        </Stack>
      </Stack>
    </RangeFilterFrame>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  histogram: css({ width: '100%', height: 80, padding: '0 6px' }),
});
