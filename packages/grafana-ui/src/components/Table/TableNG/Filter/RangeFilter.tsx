import { css } from '@emotion/css';
import { useId, useMemo, useState, useRef, useEffect } from 'react';

import {
  dateTimeFormat,
  dateTimeParse,
  type Field,
  FieldType,
  formattedValueToString,
  guessDecimals,
  type GrafanaTheme2,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';

import { useStyles2, useTheme2 } from '../../../../themes/ThemeContext';
import { adjustDateForReactCalendar } from '../../../DateTimePickers/utils/adjustDateForReactCalendar';
import { FieldValidationMessage } from '../../../Forms/FieldValidationMessage';
import { Input } from '../../../Input/Input';
import { Box } from '../../../Layout/Box/Box';
import { Stack } from '../../../Layout/Stack/Stack';
import { RangeSliderG14 } from '../../../Slider/RangeSliderG14';
import { type TableRow } from '../types';
import { getDisplayName } from '../utils';

import { FilterPopupFooter } from './FilterPopupLayout';
import { TableRangeFields } from './TableRangeFields';

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

export function sliderDecimals(field: Field, values: number[], range: number) {
  const display = field.display;
  const displayed = display
    ? values
        .slice(0, 100)
        .map((value) => Number(display(value).text.replaceAll(',', '')))
        .filter(Number.isFinite)
    : [];
  const dataDecimals =
    field.config.decimals ??
    (displayed.length > 0
      ? displayed.reduce((decimals, value) => Math.max(decimals, guessDecimals(value)), 0)
      : Math.min(
          3,
          values.reduce((decimals, value) => Math.max(decimals, guessDecimals(Number(value.toPrecision(10)))), 0)
        ));
  const rangeDecimals = range > 0 && range < 1 ? Math.ceil(-Math.log10(range)) : 0;
  return Math.min(100, Math.max(0, dataDecimals, rangeDecimals));
}

export function sliderBoundText(value: number, currentValue: number, currentText: string, decimals: number) {
  return value === currentValue ? currentText : String(Number(value.toFixed(decimals)));
}

const rangeSelectors = selectors.components.Panels.Visualization.TableNG.Filters.Range;

const DATE_FORMAT = 'YYYY-MM-DD HH:mm:ss.SSS';
function calendarBoundary(value: number, timeZone: string, endOfDay: boolean) {
  const date = adjustDateForReactCalendar(new Date(value), timeZone);
  date.setHours(endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0);
  return date;
}

export function RangeFilter({ field, rows, range, timeZone = 'browser', onApply, onClear, onCancel }: Props) {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);
  const id = useId();
  const validationId = useId();
  const calendarAnchor = useRef<HTMLElement | null>(null);
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
  const values = useMemo(
    () => rows.filter((row) => row.__depth === 0).map((row) => field.values[row.__index]),
    [rows, field]
  );
  const histogram = useMemo(() => rangeHistogram(values), [values]);
  const sliderRange = histogram.max - histogram.min;
  const decimals = useMemo(
    () => sliderDecimals(field, histogram.finite, sliderRange),
    [field, histogram.finite, sliderRange]
  );
  const sliderStep = Math.max(sliderRange / 1000, 10 ** -decimals);
  const parse = (value: string) =>
    value.trim() === ''
      ? undefined
      : isTime
        ? dateTimeParse(value, { timeZone, format: DATE_FORMAT }).valueOf()
        : Number(value);
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
  const minimumInvalid = min != null && !Number.isFinite(min);
  const maximumInvalid = max != null && !Number.isFinite(max);
  const boundsReversed = min != null && max != null && min > max;
  const invalid = minimumInvalid || maximumInvalid || boundsReversed;
  const count = invalid
    ? 0
    : histogram.finite.filter((value) => (min == null || value >= min) && (max == null || value <= max)).length;
  const formatValue = (value: number) => (field.display ? formattedValueToString(field.display(value)) : String(value));
  const maxCount = Math.max(1, ...histogram.bins);
  const minimumLabel = isTime
    ? t('grafana-ui.table.range.start', 'Start')
    : t('grafana-ui.table.range.minimum', 'Minimum');
  const maximumLabel = isTime ? t('grafana-ui.table.range.end', 'End') : t('grafana-ui.table.range.maximum', 'Maximum');

  return (
    <Stack
      ref={(element) => {
        calendarAnchor.current = element?.parentElement ?? null;
      }}
      direction="column"
      gap={1.5}
      role="group"
      aria-label={t('grafana-ui.table.range.label', 'Filter {{field}}', { field: getDisplayName(field) })}
    >
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
        </>
      )}
      {isTime ? (
        <div>
          <TableRangeFields
            calendarAnchor={calendarAnchor}
            from={{
              label: minimumLabel,
              inputRef: minimumRef,
              value: lower,
              placeholder: Number.isFinite(histogram.min)
                ? formatInput(histogram.min)
                : t('grafana-ui.table.range.unbounded', 'No limit'),
              testId: rangeSelectors.minimumInput,
              onChange: setLower,
              invalid: minimumInvalid || boundsReversed,
              errorId: validationId,
            }}
            to={{
              label: maximumLabel,
              value: upper,
              placeholder: Number.isFinite(histogram.max)
                ? formatInput(histogram.max)
                : t('grafana-ui.table.range.unbounded', 'No limit'),
              testId: rangeSelectors.maximumInput,
              onChange: setUpper,
              invalid: maximumInvalid || boundsReversed,
              errorId: validationId,
            }}
            calendar={{
              isFullscreen: true,
              minDate: Number.isFinite(histogram.min) ? calendarBoundary(histogram.min, timeZone, false) : undefined,
              maxDate: Number.isFinite(histogram.max) ? calendarBoundary(histogram.max, timeZone, true) : undefined,
              from: dateTimeParse(min ?? (Number.isFinite(histogram.min) ? histogram.min : Date.now()), { timeZone }),
              to: dateTimeParse(max ?? (Number.isFinite(histogram.max) ? histogram.max : Date.now()), { timeZone }),
              timeZone,
              onApply: () => {
                if (!invalid) {
                  onApply({ min, max, includeMissing: false });
                }
              },
              onChange: (from, to) => {
                setLower(formatInput(from.valueOf()));
                setUpper(formatInput(to.endOf('day').valueOf()));
              },
            }}
            calendarDisabled={histogram.finite.length === 0}
          />
        </div>
      ) : (
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
      )}
      {invalid && (
        <FieldValidationMessage id={validationId}>
          {t('grafana-ui.table.range.invalid', 'Enter valid bounds with minimum no greater than maximum.')}
        </FieldValidationMessage>
      )}
      <FilterPopupFooter
        selectedRows={count}
        totalRows={values.length}
        onClear={range !== undefined ? onClear : undefined}
        onCancel={onCancel}
        onApply={() => onApply({ min, max, includeMissing: false })}
        applyLabel={t('grafana-ui.table.range.apply', 'Apply')}
        applyDisabled={invalid}
        clearTestId={rangeSelectors.clearButton}
        cancelTestId={rangeSelectors.cancelButton}
        applyTestId={rangeSelectors.applyButton}
      />
    </Stack>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  histogram: css({ width: '100%', height: 80, padding: '0 6px' }),
});
