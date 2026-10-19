import { useId, useRef, useState } from 'react';

import { dateTimeFormat, dateTimeParse } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';

import { adjustDateForReactCalendar } from '../../../DateTimePickers/utils/adjustDateForReactCalendar';

import { RangeFilterFrame, useRangeInputFocus } from './RangeFilterFrame';
import { TableRangeFields } from './TableRangeFields';
import { type RangeFilterProps } from './rangeFilterTypes';
import { rangeValidation, useRangeValues } from './utils';

const rangeSelectors = selectors.components.Panels.Visualization.TableNG.Filters.Range;
const DATE_FORMAT = 'YYYY-MM-DD HH:mm:ss.SSS';

function calendarBoundary(value: number, timeZone: string, endOfDay: boolean) {
  const date = adjustDateForReactCalendar(new Date(value), timeZone);
  date.setHours(endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0);
  return date;
}

export function DateRangeFilter({
  field,
  rows,
  range,
  timeZone = 'browser',
  onApply,
  onClear,
  onCancel,
}: RangeFilterProps) {
  const validationId = useId();
  const calendarAnchor = useRef<HTMLElement | null>(null);
  const minimumRef = useRangeInputFocus();
  const formatInput = (value?: number) =>
    value == null ? '' : dateTimeFormat(value, { format: DATE_FORMAT, timeZone });
  const [lower, setLower] = useState(() => formatInput(range?.min));
  const [upper, setUpper] = useState(() => formatInput(range?.max));
  const { values, histogram } = useRangeValues(field, rows);
  const parse = (value: string) =>
    value.trim() === '' ? undefined : dateTimeParse(value, { timeZone, format: DATE_FORMAT }).valueOf();
  const min = parse(lower);
  const max = parse(upper);
  const { minimumInvalid, maximumInvalid, boundsReversed, invalid } = rangeValidation(min, max);

  return (
    <RangeFilterFrame
      containerRef={(element) => {
        calendarAnchor.current = element?.parentElement ?? null;
      }}
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
      <div>
        <TableRangeFields
          calendarAnchor={calendarAnchor}
          from={{
            label: t('grafana-ui.table.range.start', 'Start'),
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
            label: t('grafana-ui.table.range.end', 'End'),
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
    </RangeFilterFrame>
  );
}
