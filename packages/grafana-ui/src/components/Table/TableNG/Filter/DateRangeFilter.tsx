import { useCallback, useId, useState } from 'react';

import { dateTimeFormat, dateTimeParse } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';

import { TimeRangeFields } from '../../../DateTimePickers/TimeRangePicker/TimeRangeFields';
import { adjustDateForReactCalendar } from '../../../DateTimePickers/utils/adjustDateForReactCalendar';

import { RangeFilterFrame } from './RangeFilterFrame';
import { type RangeFilterProps } from './rangeFilterTypes';
import { useFilterInputFocus } from './useFilterInputFocus';
import { rangeValidation, useRangeValues } from './utils';

const rangeSelectors = selectors.components.Panels.Visualization.TableNG.Filters.Range;
const DATE_FORMAT = 'YYYY-MM-DD HH:mm:ss.SSS';
type DateDraft = { text: string; timeZone: string };

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
  const [calendarAnchor, setCalendarAnchor] = useState<HTMLElement | null>(null);
  const setContainerRef = useCallback((element: HTMLDivElement | null) => {
    setCalendarAnchor(element?.parentElement ?? null);
  }, []);
  const minimumRef = useFilterInputFocus();
  const formatInput = (value?: number) =>
    value == null ? '' : dateTimeFormat(value, { format: DATE_FORMAT, timeZone });
  const [lowerDraft, setLowerDraft] = useState<DateDraft>(() => ({ text: formatInput(range?.min), timeZone }));
  const [upperDraft, setUpperDraft] = useState<DateDraft>(() => ({ text: formatInput(range?.max), timeZone }));
  const { values, histogram } = useRangeValues(field, rows);
  const parse = ({ text, timeZone }: DateDraft) =>
    text.trim() === '' ? undefined : dateTimeParse(text, { timeZone, format: DATE_FORMAT }).valueOf();
  const displayDraft = (draft: DateDraft) => {
    if (draft.timeZone === timeZone) {
      return draft.text;
    }
    const value = parse(draft);
    return value == null ? '' : Number.isFinite(value) ? formatInput(value) : draft.text;
  };
  const lower = displayDraft(lowerDraft);
  const upper = displayDraft(upperDraft);
  const min = parse(lowerDraft);
  const max = parse(upperDraft);
  const { minimumInvalid, maximumInvalid, boundsReversed, invalid } = rangeValidation(min, max);

  return (
    <RangeFilterFrame
      containerRef={setContainerRef}
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
        <TimeRangeFields
          inputWidth={30}
          from={{
            label: t('grafana-ui.table.range.start', 'Start'),
            inputRef: minimumRef,
            value: lower,
            placeholder: Number.isFinite(histogram.min)
              ? formatInput(histogram.min)
              : t('grafana-ui.table.range.unbounded', 'No limit'),
            testId: rangeSelectors.minimumInput,
            fieldTestId: rangeSelectors.field('minimum'),
            onChange: (text) => setLowerDraft({ text, timeZone }),
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
            fieldTestId: rangeSelectors.field('maximum'),
            onChange: (text) => setUpperDraft({ text, timeZone }),
            invalid: maximumInvalid || boundsReversed,
            errorId: validationId,
          }}
          calendar={{
            isFullscreen: true,
            referenceElement: calendarAnchor,
            minDate: Number.isFinite(histogram.min) ? calendarBoundary(histogram.min, timeZone, false) : undefined,
            maxDate: Number.isFinite(histogram.max) ? calendarBoundary(histogram.max, timeZone, true) : undefined,
            from: dateTimeParse(min ?? (Number.isFinite(histogram.min) ? histogram.min : Date.now()), { timeZone }),
            to: dateTimeParse(max ?? (Number.isFinite(histogram.max) ? histogram.max : Date.now()), { timeZone }),
            timeZone,
            onChange: (from, to) => {
              setLowerDraft({ text: formatInput(from.valueOf()), timeZone });
              setUpperDraft({ text: formatInput(to.endOf('day').valueOf()), timeZone });
            },
          }}
          calendarDisabled={histogram.finite.length === 0}
        />
      </div>
    </RangeFilterFrame>
  );
}
