import { css } from '@emotion/css';
import { useId, useMemo, useState, useRef, useEffect } from 'react';

import {
  dateTimeFormat,
  dateTimeParse,
  type Field,
  FieldType,
  formattedValueToString,
  type GrafanaTheme2,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';

import { useStyles2, useTheme2 } from '../../../../themes/ThemeContext';
import { Button } from '../../../Button/Button';
import { TimeRangeFields } from '../../../DateTimePickers/TimeRangePicker/TimeRangeFields';
import { Input } from '../../../Input/Input';
import { Stack } from '../../../Layout/Stack/Stack';
import { RangeSlider } from '../../../Slider/RangeSlider';
import { type TableRow } from '../types';
import { getDisplayName } from '../utils';

type Range = { min?: number; max?: number; includeMissing: boolean };
interface Props {
  field: Field;
  rows: TableRow[];
  range?: Range;
  timeZone?: string;
  onApply: (range: Range) => void;
  onClear: () => void;
  onCancel: () => void;
}

export function rangeHistogram(values: unknown[]) {
  const finite = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  let min = Infinity;
  let max = -Infinity;
  for (const value of finite) {
    min = Math.min(min, value);
    max = Math.max(max, value);
  }
  const bins = Array.from({ length: finite.length === 0 ? 0 : min === max ? 1 : 30 }, () => 0);
  for (const value of finite) {
    const index = min === max ? 0 : Math.min(bins.length - 1, Math.floor(((value - min) / (max - min)) * bins.length));
    bins[index]++;
  }
  return { finite, min, max, bins, missing: values.length - finite.length };
}

const rangeSelectors = selectors.components.Panels.Visualization.TableNG.Filters.Range;

const DATE_FORMAT = 'YYYY-MM-DD HH:mm:ss.SSS';
export function RangeFilter({ field, rows, range, timeZone = 'browser', onApply, onClear, onCancel }: Props) {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);
  const id = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const minimumRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    // The closing column menu restores its trigger focus before this popup takes over.
    const frame = requestAnimationFrame(() => minimumRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, []);
  const isTime = field.type === FieldType.time;
  const formatInput = (value?: number) =>
    value == null ? '' : isTime ? dateTimeFormat(value, { format: DATE_FORMAT, timeZone }) : String(value);
  const [lower, setLower] = useState(() => formatInput(range?.min));
  const [upper, setUpper] = useState(() => formatInput(range?.max));
  const [includeMissing, setIncludeMissing] = useState(range?.includeMissing ?? false);
  const values = useMemo(
    () => rows.filter((row) => row.__depth === 0).map((row) => field.values[row.__index]),
    [rows, field]
  );
  const histogram = useMemo(() => rangeHistogram(values), [values]);
  const parse = (value: string) =>
    value.trim() === ''
      ? undefined
      : isTime
        ? dateTimeParse(value, { timeZone, format: DATE_FORMAT }).valueOf()
        : Number(value);
  const min = parse(lower);
  const max = parse(upper);
  const invalid =
    (min != null && !Number.isFinite(min)) ||
    (max != null && !Number.isFinite(max)) ||
    (min != null && max != null && min > max);
  const count = invalid
    ? 0
    : histogram.finite.filter((value) => (min == null || value >= min) && (max == null || value <= max)).length +
      (includeMissing ? histogram.missing : 0);
  const formatValue = (value: number) => (field.display ? formattedValueToString(field.display(value)) : String(value));
  const maxCount = Math.max(1, ...histogram.bins);
  const minimumLabel = isTime
    ? t('grafana-ui.table.range.start', 'Start')
    : t('grafana-ui.table.range.minimum', 'Minimum');
  const maximumLabel = isTime ? t('grafana-ui.table.range.end', 'End') : t('grafana-ui.table.range.maximum', 'Maximum');

  return (
    <div
      ref={containerRef}
      className={styles.container}
      role="group"
      aria-label={t('grafana-ui.table.range.label', 'Filter {{field}}', { field: getDisplayName(field) })}
    >
      <strong>{getDisplayName(field)}</strong>
      <div className={styles.muted}>
        {isTime
          ? t('grafana-ui.table.range.timezone', 'Timezone: {{timeZone}}', {
              timeZone: timeZone === 'browser' ? Intl.DateTimeFormat().resolvedOptions().timeZone : timeZone,
              interpolation: { escapeValue: false },
            })
          : t('grafana-ui.table.range.units', 'Exact bounds use raw values (field unit: {{unit}}).', {
              unit: field.config.unit ?? 'none',
            })}
      </div>
      {!isTime && (
        <>
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
                <RangeSlider
                  controlled
                  min={histogram.min}
                  max={histogram.max}
                  value={[
                    Math.max(
                      histogram.min,
                      Math.min(histogram.max, min != null && Number.isFinite(min) ? min : histogram.min)
                    ),
                    Math.max(
                      histogram.min,
                      Math.min(histogram.max, max != null && Number.isFinite(max) ? max : histogram.max)
                    ),
                  ]}
                  step={(histogram.max - histogram.min) / 1000}
                  tooltipAlwaysVisible={false}
                  ariaLabelForHandle={[minimumLabel, maximumLabel]}
                  formatTooltipResult={formatValue}
                  onChange={([min, max]) => {
                    setLower(String(Number(min.toPrecision(12))));
                    setUpper(String(Number(max.toPrecision(12))));
                  }}
                />
              )}
              <div className={styles.endpoints}>
                <span>{formatValue(histogram.min)}</span>
                <span>{formatValue(histogram.max)}</span>
              </div>
            </>
          ) : (
            <div>{t('grafana-ui.table.range.empty', 'No finite values match the other filters.')}</div>
          )}
        </>
      )}
      {isTime ? (
        <div>
          <TimeRangeFields
            fromLabel={minimumLabel}
            toLabel={maximumLabel}
            fromInput={{
              ref: minimumRef,
              value: lower,
              placeholder: t('grafana-ui.table.range.unbounded', 'No limit'),
              'data-testid': rangeSelectors.minimum,
              onChange: (event) => setLower(event.currentTarget.value),
            }}
            toInput={{
              value: upper,
              placeholder: t('grafana-ui.table.range.unbounded', 'No limit'),
              'data-testid': rangeSelectors.maximum,
              onChange: (event) => setUpper(event.currentTarget.value),
            }}
            getCalendarAnchor={() => containerRef.current?.parentElement ?? null}
            calendar={{
              isFullscreen: true,
              from: dateTimeParse(min ?? (Number.isFinite(histogram.min) ? histogram.min : Date.now()), { timeZone }),
              to: dateTimeParse(max ?? (Number.isFinite(histogram.max) ? histogram.max : Date.now()), { timeZone }),
              timeZone,
              onApply: () => {
                if (!invalid) {
                  onApply({ min, max, includeMissing });
                }
              },
              onChange: (from, to) => {
                setLower(formatInput(from.valueOf()));
                setUpper(formatInput(to.endOf('day').valueOf()));
              },
            }}
          />
        </div>
      ) : (
        <Stack gap={1}>
          <div className={styles.boundInput}>
            <label htmlFor={`${id}-min`}>{minimumLabel}</label>
            <Input
              id={`${id}-min`}
              ref={minimumRef}
              data-testid={rangeSelectors.minimum}
              type="text"
              inputMode="decimal"
              value={lower}
              placeholder={t('grafana-ui.table.range.unbounded', 'No limit')}
              onChange={(event) => setLower(event.currentTarget.value)}
            />
          </div>
          <div className={styles.boundInput}>
            <label htmlFor={`${id}-max`}>{maximumLabel}</label>
            <Input
              id={`${id}-max`}
              data-testid={rangeSelectors.maximum}
              type="text"
              inputMode="decimal"
              value={upper}
              placeholder={t('grafana-ui.table.range.unbounded', 'No limit')}
              onChange={(event) => setUpper(event.currentTarget.value)}
            />
          </div>
        </Stack>
      )}
      <label className={styles.missing}>
        <input
          type="checkbox"
          data-testid={rangeSelectors.includeMissing}
          checked={includeMissing}
          onChange={(event) => setIncludeMissing(event.currentTarget.checked)}
        />
        {t('grafana-ui.table.range.missing', 'Include missing / non-finite values ({{amount}})', {
          amount: histogram.missing,
        })}
      </label>
      {invalid && (
        <div role="alert">
          {t('grafana-ui.table.range.invalid', 'Enter valid bounds with minimum no greater than maximum.')}
        </div>
      )}
      <div role="status">
        {t('grafana-ui.table.range.matches', '{{amount}} of {{total}} rows match', {
          amount: count,
          total: values.length,
        })}
      </div>
      <div className={styles.actions}>
        <Button size="sm" fill="text" variant="secondary" onClick={onClear} data-testid={rangeSelectors.clear}>
          {t('grafana-ui.table.range.clear', 'Clear')}
        </Button>
        <Button size="sm" variant="secondary" onClick={onCancel} data-testid={rangeSelectors.cancel}>
          {t('grafana-ui.table.range.cancel', 'Cancel')}
        </Button>
        <Button
          size="sm"
          disabled={invalid}
          data-testid={rangeSelectors.apply}
          onClick={() => onApply({ min, max, includeMissing })}
        >
          {t('grafana-ui.table.range.apply', 'Apply')}
        </Button>
      </div>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({ width: 340, display: 'flex', flexDirection: 'column', gap: theme.spacing(1.5) }),
  histogram: css({ width: '100%', height: 80, padding: '0 6px' }),
  muted: css({ color: theme.colors.text.secondary, fontSize: theme.typography.bodySmall.fontSize }),
  endpoints: css({ display: 'flex', justifyContent: 'space-between', color: theme.colors.text.secondary }),
  boundInput: css({ flex: 1, minWidth: 0 }),
  missing: css({ display: 'flex', gap: theme.spacing(1), alignItems: 'center' }),
  actions: css({ display: 'flex', justifyContent: 'flex-end', gap: theme.spacing(1) }),
});
