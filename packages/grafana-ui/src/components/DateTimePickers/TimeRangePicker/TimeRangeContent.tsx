import { css } from '@emotion/css';
import { type KeyboardEvent, useCallback, useEffect, useId, useState } from 'react';
import { useForm } from 'react-hook-form';

import {
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
  const nowLabel = t('time-picker.range-content.now', 'Now');

  const {
    handleSubmit,
    register,
    formState: { errors },
    setValue,
    watch,
  } = useForm<FormState>({
    defaultValues: {
      from: valueAsString(value.raw.from, timeZone, nowLabel),
      to: valueAsString(value.raw.to, timeZone, nowLabel),
    },
  });

  const fromFieldId = useId();
  const toFieldId = useId();

  // Synchronize internal state with external value
  useEffect(() => {
    setValue('from', valueAsString(value.raw.from, timeZone, nowLabel));
    setValue('to', valueAsString(value.raw.to, timeZone, nowLabel));
  }, [value.raw.from, value.raw.to, setValue, timeZone, nowLabel]);

  const onOpen = () => setOpen(true);

  const onApply = useCallback(() => {
    handleSubmit((data) => {
      const raw: RawTimeRange = {
        from: rawTimeValue(data.from, nowLabel),
        to: rawTimeValue(data.to, nowLabel),
      };
      const timeRange = rangeUtil.convertRawToRange(raw, timeZone, fiscalYearStartMonth);
      onApplyFromProps(timeRange);
    })();
  }, [handleSubmit, timeZone, fiscalYearStartMonth, onApplyFromProps, nowLabel]);

  const onChange = useCallback(
    (from: DateTime | string, to: DateTime | string) => {
      setValue('from', valueAsString(from, timeZone, nowLabel));
      setValue('to', valueAsString(to, timeZone, nowLabel));
    },
    [nowLabel, setValue, timeZone]
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

    setValue('from', valueAsString(range.from, timeZone, nowLabel));
    setValue('to', valueAsString(range.to, timeZone, nowLabel));
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
                if (!isValid(rawTimeValue(value, nowLabel), false, timeZone)) {
                  return ERROR_MESSAGES.default();
                }
                if (
                  !!formValues.to &&
                  isValid(rawTimeValue(formValues.to, nowLabel), true, timeZone) &&
                  isRangeInvalid(rawTimeValue(value, nowLabel), rawTimeValue(formValues.to, nowLabel), timeZone)
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
                if (!isValid(rawTimeValue(value, nowLabel), true, timeZone)) {
                  return ERROR_MESSAGES.default();
                }
                if (
                  !!formValues.from &&
                  isValid(rawTimeValue(formValues.from, nowLabel), false, timeZone) &&
                  isRangeInvalid(rawTimeValue(formValues.from, nowLabel), rawTimeValue(value, nowLabel), timeZone)
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

function isRangeInvalid(from: string, to: string, timezone?: string): boolean {
  const raw: RawTimeRange = { from, to };
  const timeRange = rangeUtil.convertRawToRange(raw, timezone);
  const valid = timeRange.from.isSame(timeRange.to) || timeRange.from.isBefore(timeRange.to);

  return !valid;
}

function valueAsString(value: DateTime | string, timeZone?: TimeZone, nowLabel?: string): string {
  if (isDateTime(value)) {
    return dateTimeFormat(value, { timeZone });
  }

  if (nowLabel && isNowExpression(value)) {
    return `${nowLabel}${value.slice('now'.length)}`;
  }

  if (value.endsWith('Z')) {
    const dt = dateTimeParse(value);
    return dateTimeFormat(dt, { timeZone });
  }

  return value;
}

function rawTimeValue(value: string, nowLabel: string): string {
  if (isNowExpression(value, nowLabel)) {
    return `now${value.slice(nowLabel.length)}`;
  }

  return value;
}

function isNowExpression(value: string, nowLabel = 'now'): boolean {
  return (
    value === nowLabel ||
    value.startsWith(`${nowLabel}-`) ||
    value.startsWith(`${nowLabel}+`) ||
    value.startsWith(`${nowLabel}/`)
  );
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
