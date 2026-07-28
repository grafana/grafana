import { css } from '@emotion/css';
import { type KeyboardEvent, useCallback, useEffect, useId, useRef, useState } from 'react';
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
import { Checkbox } from '../../Forms/Checkbox';
import { Field } from '../../Forms/Field';
import { Icon } from '../../Icon/Icon';
import { Input } from '../../Input/Input';
import { Tooltip } from '../../Tooltip/Tooltip';
import { type WeekStart } from '../WeekStartPicker';
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
  default: (dateExample: string) =>
    t(
      'time-picker.range-content.default-error',
      'Enter a date ({{dateExample}}) or relative time ({{relativeTimeExample1}}, {{relativeTimeExample2}})',
      {
        dateExample,
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
  // Default to showing milliseconds when the range is absolute and carries a non-zero fraction, so a
  // reopened ms range stays visible. Relative ranges (e.g. now-6h) never match, keeping the common case off.
  const [showMs, setShowMs] = useState(() => hasMilliseconds(value.raw.from) || hasMilliseconds(value.raw.to));

  const {
    handleSubmit,
    register,
    formState: { errors },
    getValues,
    setValue,
    watch,
  } = useForm<FormState>({
    defaultValues: {
      from: valueAsString(value.raw.from, timeZone, showMs),
      to: valueAsString(value.raw.to, timeZone, showMs),
    },
  });

  const fromFieldId = useId();
  const toFieldId = useId();
  const dateExample = showMs ? 'YYYY-MM-DD HH:mm:ss.SSS' : 'YYYY-MM-DD HH:mm:ss';

  // The external-value sync effect should not clobber in-progress edits when the toggle flips, so it
  // reads the current toggle from a ref instead of depending on it.
  const showMsRef = useRef(showMs);
  showMsRef.current = showMs;

  // Synchronize internal state with external value
  useEffect(() => {
    setValue('from', valueAsString(value.raw.from, timeZone, showMsRef.current));
    setValue('to', valueAsString(value.raw.to, timeZone, showMsRef.current));
  }, [value.raw.from, value.raw.to, setValue, timeZone]);

  // Reformat the current field values in place when the toggle changes, preserving edits that haven't
  // been applied yet. Relative values (e.g. now-5m) are left untouched.
  const onToggleMs = useCallback(
    (next: boolean) => {
      setShowMs(next);
      setValue('from', reformatInput(getValues('from'), timeZone, next));
      setValue('to', reformatInput(getValues('to'), timeZone, next));
    },
    [getValues, setValue, timeZone]
  );

  const onOpen = () => setOpen(true);

  const onApply = useCallback(() => {
    handleSubmit((data) => {
      const raw: RawTimeRange = { from: data.from, to: data.to };
      const timeRange = rangeUtil.convertRawToRange(raw, timeZone, fiscalYearStartMonth);
      onApplyFromProps(timeRange);
    })();
  }, [handleSubmit, timeZone, fiscalYearStartMonth, onApplyFromProps]);

  const onChange = useCallback(
    (from: DateTime | string, to: DateTime | string) => {
      setValue('from', valueAsString(from, timeZone, showMs));
      setValue('to', valueAsString(to, timeZone, showMs));
    },
    [setValue, timeZone, showMs]
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
                  return ERROR_MESSAGES.default(dateExample);
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
                  return ERROR_MESSAGES.default(dateExample);
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
      <div className={style.msToggleContainer}>
        <Checkbox
          label={t('time-picker.range-content.milliseconds-label', 'Show milliseconds')}
          value={showMs}
          onChange={(event) => onToggleMs(event.currentTarget.checked)}
        />
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

function isRangeInvalid(from: string, to: string, timezone?: string): boolean {
  const raw: RawTimeRange = { from, to };
  const timeRange = rangeUtil.convertRawToRange(raw, timezone);
  const valid = timeRange.from.isSame(timeRange.to) || timeRange.from.isBefore(timeRange.to);

  return !valid;
}

function valueAsString(value: DateTime | string, timeZone?: TimeZone, withMs?: boolean): string {
  if (isDateTime(value)) {
    return dateTimeFormat(value, { timeZone, defaultWithMS: withMs });
  }

  if (value.endsWith('Z')) {
    const dt = dateTimeParse(value);
    return dateTimeFormat(dt, { timeZone, defaultWithMS: withMs });
  }

  return value;
}

// Detects a non-zero millisecond fraction. `raw` may be a DateTime (legacy time srv) or an absolute
// ISO string with ms (scenes serializes applied ranges as `YYYY-MM-DDTHH:mm:ss.SSSZ`), so both are
// handled. Relative values (now, now-5m) never carry a fraction.
function hasMilliseconds(value: DateTime | string): boolean {
  if (typeof value === 'string' && dateMath.isMathString(value)) {
    return false;
  }
  const parsed = isDateTime(value) ? value : dateTimeParse(value);
  return parsed.isValid() && parsed.format('SSS') !== '000';
}

// Re-render an input value with or without milliseconds. Relative values (now, now-5m) and anything
// that doesn't parse are returned unchanged so the toggle never rewrites them.
function reformatInput(value: string, timeZone: TimeZone | undefined, withMs: boolean): string {
  if (dateMath.isMathString(value)) {
    return value;
  }
  const parsed = dateTimeParse(value, { timeZone });
  return parsed.isValid() ? dateTimeFormat(parsed, { timeZone, defaultWithMS: withMs }) : value;
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
    msToggleContainer: css({
      marginTop: theme.spacing(1),
    }),
    tooltip: css({
      paddingLeft: theme.spacing(1),
      paddingTop: theme.spacing(3),
    }),
  };
}
