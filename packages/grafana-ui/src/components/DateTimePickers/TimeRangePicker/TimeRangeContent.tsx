import { css } from '@emotion/css';
import { type KeyboardEvent, useCallback, useEffect, useId, useState } from 'react';
import { useForm } from 'react-hook-form';

import {
  dateMath,
  type DateTime,
  dateTimeFormat,
  dateTimeParse,
  type GrafanaTheme2,
  isDateTime,
  rangeUtil,
  type RawTimeRange,
  type TimeRange,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t, Trans } from '@grafana/i18n';
import { type TimeZone } from '@grafana/schema';

import { useStyles2 } from '../../../themes/ThemeContext';
import { Button } from '../../Button/Button';
import { Field } from '../../Forms/Field';
import { Icon } from '../../Icon/Icon';
import { Input } from '../../Input/Input';
import { Tooltip } from '../../Tooltip/Tooltip';
import { type WeekStart } from '../WeekStartPicker';
import { commonFormat } from '../commonFormat';
import { isValid } from '../utils';

import TimePickerCalendar from './TimePickerCalendar';

interface Props {
  isFullscreen: boolean;
  value: TimeRange;
  onApply: (range: TimeRange) => void;
  timeZone?: TimeZone;
  fiscalYearStartMonth?: number;
  roundup?: boolean;
  isReversed?: boolean;
  onError?: (error?: string) => void;
  weekStart?: WeekStart;
}

interface FormState {
  from: string;
  to: string;
}

const ERROR_MESSAGES = {
  required: () => t('time-picker.range-content.required-error', 'This field is required'),
  default: () =>
    t(
      'time-picker.range-content.default-error',
      'Enter a date ({{dateExample}}) or relative time ({{relativeTimeExample1}}, {{relativeTimeExample2}})',
      {
        dateExample: 'YYYY-MM-DD HH:mm:ss',
        relativeTimeExample1: 'now',
        relativeTimeExample2: 'now-1h',
      }
    ),
  range: () => t('time-picker.range-content.range-error', '"From" date must be before "To" date'),
};

export const TimeRangeContent = (props: Props) => {
  const {
    value,
    isFullscreen = false,
    timeZone,
    onApply: onApplyFromProps,
    isReversed,
    fiscalYearStartMonth,
    onError,
    weekStart,
  } = props;
  const style = useStyles2(getStyles);
  const [isOpen, setOpen] = useState(false);

  const {
    handleSubmit,
    register,
    formState: { errors },
    setValue,
    watch,
  } = useForm<FormState>({
    defaultValues: {
      from: valueAsString(value.raw.from, timeZone),
      to: valueAsString(value.raw.to, timeZone),
    },
  });

  const fromFieldId = useId();
  const toFieldId = useId();

  // Synchronize internal state with external value
  useEffect(() => {
    setValue('from', valueAsString(value.raw.from, timeZone));
    setValue('to', valueAsString(value.raw.to, timeZone));
  }, [value.raw.from, value.raw.to, setValue, timeZone]);

  const onOpen = () => setOpen(true);

  const onApply = useCallback(() => {
    handleSubmit((data) => {
      /**
       * ARCHITECTURAL NOTE:
       * We bypass rangeUtil.convertRawToRange to utilize the upgraded dateMath.parse
       * engine directly. This ensures that ISO 8601 week strings (YYYY-Www) are
       * parsed correctly with proper boundary resolution (Monday-Sunday).
       * * We pass 'fiscalYearStartMonth' and 'timeZone' to ensure no regression in
       * existing fiscal or timezone-specific math logic.
       */
      const from = dateMath.parse(data.from, false, timeZone, fiscalYearStartMonth);
      const to = dateMath.parse(data.to, true, timeZone, fiscalYearStartMonth);

      if (from && to) {
        onApplyFromProps({
          from,
          to,
          // We pass back the raw input strings so the UI retains the 'YYYY-Www'
          // format in the input fields instead of being replaced by timestamps.
          raw: { from: data.from, to: data.to },
        });
      }
    })();
  }, [handleSubmit, timeZone, fiscalYearStartMonth, onApplyFromProps]);

  const onChange = useCallback(
    (from: DateTime | string, to: DateTime | string) => {
      setValue('from', valueAsString(from, timeZone));
      setValue('to', valueAsString(to, timeZone));
    },
    [setValue, timeZone]
  );

  const submitOnEnter = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      onApply();
    }
  };

  const onCopy = () => {
    const rawSource: RawTimeRange = value.raw;
    const clipboardPayload = rangeUtil.formatRawTimeRange(rawSource);
    navigator.clipboard.writeText(JSON.stringify(clipboardPayload));
  };

  const onPaste = async () => {
    const raw = await navigator.clipboard.readText();
    let range;

    try {
      range = JSON.parse(raw);
    } catch (error) {
      if (onError) {
        onError(raw);
      }
      return;
    }

    setValue('from', valueAsString(range.from, timeZone));
    setValue('to', valueAsString(range.to, timeZone));
  };

  const fiscalYear = rangeUtil.convertRawToRange({ from: 'now/fy', to: 'now/fy' }, timeZone, fiscalYearStartMonth);

  const fyTooltip = (
    <div className={style.tooltip}>
      {rangeUtil.isFiscal(value) ? (
        <Tooltip
          content={t('time-picker.range-content.fiscal-year', 'Fiscal year: {{from}} - {{to}}', {
            from: fiscalYear.from.format('MMM-DD'),
            to: fiscalYear.to.format('MMM-DD'),
          })}
        >
          <Icon name="info-circle" />
        </Tooltip>
      ) : null}
    </div>
  );

  const icon = (
    <Button
      aria-label={t('time-picker.range-content.open-input-calendar', 'Open calendar')}
      data-testid={selectors.components.TimePicker.calendar.openButton}
      icon="calendar-alt"
      variant="secondary"
      type="button"
      onClick={onOpen}
    />
  );

  return (
    <div>
      <div className={style.fieldContainer}>
        <Field
          label={t('time-picker.range-content.from-input', 'From')}
          invalid={!!errors.from}
          error={errors.from?.message}
        >
          <Input
            {...register('from', {
              required: ERROR_MESSAGES.required(),

              validate: (value, formValues) => {
                if (!isValid(value, false, timeZone)) {
                  return ERROR_MESSAGES.default();
                }
                if (
                  !!formValues.to &&
                  isValid(formValues.to, true, timeZone) &&
                  isRangeInvalid(value, formValues.to, timeZone)
                ) {
                  return ERROR_MESSAGES.range();
                }
                return true;
              },
            })}
            id={fromFieldId}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={submitOnEnter}
            addonAfter={icon}
            data-testid={selectors.components.TimePicker.fromField}
          />
        </Field>
        {fyTooltip}
      </div>
      <div className={style.fieldContainer}>
        <Field label={t('time-picker.range-content.to-input', 'To')} invalid={!!errors.to} error={errors.to?.message}>
          <Input
            {...register('to', {
              required: ERROR_MESSAGES.required(),
              validate: (value, formValues) => {
                if (!isValid(value, true, timeZone)) {
                  return ERROR_MESSAGES.default();
                }
                if (
                  !!formValues.from &&
                  isValid(formValues.from, false, timeZone) &&
                  isRangeInvalid(formValues.from, value, timeZone)
                ) {
                  return ERROR_MESSAGES.range();
                }
                return true;
              },
            })}
            id={toFieldId}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={submitOnEnter}
            addonAfter={icon}
            data-testid={selectors.components.TimePicker.toField}
          />
        </Field>
        {fyTooltip}
      </div>
      <div className={style.buttonsContainer}>
        <Button
          data-testid={selectors.components.TimePicker.copyTimeRange}
          icon="copy"
          variant="secondary"
          tooltip={t('time-picker.copy-paste.tooltip-copy', 'Copy time range to clipboard')}
          type="button"
          onClick={onCopy}
        />
        <Button
          data-testid={selectors.components.TimePicker.pasteTimeRange}
          icon="clipboard-alt"
          variant="secondary"
          tooltip={t('time-picker.copy-paste.tooltip-paste', 'Paste time range')}
          type="button"
          onClick={onPaste}
        />
        <Button data-testid={selectors.components.TimePicker.applyTimeRange} type="button" onClick={onApply}>
          <Trans i18nKey="time-picker.range-content.apply-button">Apply time range</Trans>
        </Button>
      </div>

      <TimePickerCalendar
        isFullscreen={isFullscreen}
        isOpen={isOpen}
        from={dateTimeParse(watch('from'), { timeZone })}
        to={dateTimeParse(watch('to'), { timeZone })}
        onApply={onApply}
        onClose={() => setOpen(false)}
        onChange={onChange}
        timeZone={timeZone}
        isReversed={isReversed}
        weekStart={weekStart}
      />
    </div>
  );
};

/**
 * Validates that the 'from' date is chronologically before or equal to the 'to' date.
 * We use dateMath.parse directly to ensure the 'to' field correctly respects
 * the roundUp boundary (e.g., Sunday for ISO weeks), preventing false positives
 * when the same week is entered in both fields.
 */
function isRangeInvalid(from: string, to: string, timezone?: string): boolean {
  // Parse both ends of the range.
  // 'from' is parsed to the start of the period, 'to' is parsed to the end.
  const fromDate = dateMath.parse(from, false, timezone);
  const toDate = dateMath.parse(to, true, timezone);

  // If either string is currently unparseable, we let the individual
  // field validators handle the "Invalid Date" UI feedback.
  if (!fromDate || !toDate || !fromDate.isValid() || !toDate.isValid()) {
    return false;
  }

  // The range is invalid ONLY if 'from' is strictly after 'to'.
  // Using .valueOf() is the safest way to compare timestamps in TS.
  return fromDate.valueOf() > toDate.valueOf();
}

function valueAsString(value: DateTime | string, timeZone?: TimeZone): string {
  if (isDateTime(value)) {
    return dateTimeFormat(value, { timeZone, format: commonFormat });
  }

  if (value.endsWith('Z')) {
    const dt = dateTimeParse(value);
    return dateTimeFormat(dt, { timeZone, format: commonFormat });
  }

  return value;
}

function getStyles(theme: GrafanaTheme2) {
  return {
    fieldContainer: css({
      display: 'flex',
    }),
    buttonsContainer: css({
      display: 'flex',
      gap: theme.spacing(0.5),
      marginTop: theme.spacing(1),
    }),
    tooltip: css({
      paddingLeft: theme.spacing(1),
      paddingTop: theme.spacing(3),
    }),
  };
}
