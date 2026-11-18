import { css } from '@emotion/css';
import { useCallback, useEffect, useId, useState } from 'react';
import { useController, useForm } from 'react-hook-form';

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
import { Stack } from '../../Layout/Stack/Stack';
import { Tooltip } from '../../Tooltip/Tooltip';
import { type WeekStart } from '../WeekStartPicker';
import { isValid } from '../utils';

import { Body } from './CalendarBody';
import { Footer } from './CalendarFooter';

interface Props {
  value: TimeRange;
  onApply: (range: TimeRange) => void;
  timeZone?: TimeZone;
  fiscalYearStartMonth?: number;
  roundup?: boolean;
  onError?: (error?: string) => void;
  weekStart?: WeekStart;
}

interface FormState {
  from: string;
  to: string;
}

const ERROR_MESSAGES = {
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

/**
 * Experimental copy of TimeRangeContent where the calendar replaces the form inside the picker instead of opening
 * in a modal.
 */
export const TimeRangeContentInline = (props: Props) => {
  const { value, timeZone, onApply: onApplyFromProps, fiscalYearStartMonth, onError, weekStart } = props;
  const style = useStyles2(getStyles);
  const fromId = useId();
  const toId = useId();
  const [isCalendarOpen, setCalendarOpen] = useState(false);

  const {
    handleSubmit,
    control,
    formState: { errors },
    setValue,
  } = useForm<FormState>({
    defaultValues: {
      from: valueAsString(value.raw.from, timeZone),
      to: valueAsString(value.raw.to, timeZone),
    },
  });

  const { field: fromField } = useController({
    name: 'from',
    control,
    rules: {
      required: ERROR_MESSAGES.default(),
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
    },
  });
  const { field: toField } = useController({
    name: 'to',
    control,
    rules: {
      required: ERROR_MESSAGES.default(),
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
    },
  });

  // Synchronize internal state with external value
  useEffect(() => {
    setValue('from', valueAsString(value.raw.from, timeZone));
    setValue('to', valueAsString(value.raw.to, timeZone));
  }, [value.raw.from, value.raw.to, setValue, timeZone]);

  const onApply = useCallback(() => {
    handleSubmit((data) => {
      const raw: RawTimeRange = { from: data.from, to: data.to };
      const timeRange = rangeUtil.convertRawToRange(raw, timeZone, fiscalYearStartMonth);
      onApplyFromProps(timeRange);
    })();
  }, [handleSubmit, timeZone, fiscalYearStartMonth, onApplyFromProps]);

  const onChange = useCallback(
    (from: DateTime | string, to: DateTime | string) => {
      setValue('from', valueAsString(from, timeZone));
      setValue('to', valueAsString(to, timeZone));
    },
    [setValue, timeZone]
  );

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

  if (isCalendarOpen) {
    return (
      <Stack direction="column" gap={1}>
        <div className={style.calendar}>
          <Body
            from={dateTimeParse(fromField.value, { timeZone })}
            to={dateTimeParse(toField.value, { timeZone })}
            onChange={onChange}
            timeZone={timeZone}
            weekStart={weekStart}
          />
        </div>
        <div className={style.footer}>
          <Footer
            isOpen
            isFullscreen={false}
            from={dateTimeParse(fromField.value, { timeZone })}
            to={dateTimeParse(toField.value, { timeZone })}
            onChange={onChange}
            onClose={() => setCalendarOpen(false)}
            onApply={() => {
              onApply();
              setCalendarOpen(false);
            }}
          />
        </div>
      </Stack>
    );
  }

  const calendarButton = (
    <Button
      aria-label={t('time-picker.range-content.open-input-calendar', 'Open calendar')}
      data-testid={selectors.components.TimePicker.calendar.openButton}
      icon="calendar-alt"
      variant="secondary"
      type="button"
      onClick={() => setCalendarOpen(true)}
    />
  );

  const fields = [
    {
      id: fromId,
      label: t('time-picker.range-content.from-input', 'From'),
      field: fromField,
      error: errors.from?.message,
      testId: selectors.components.TimePicker.fromField,
    },
    {
      id: toId,
      label: t('time-picker.range-content.to-input', 'To'),
      field: toField,
      error: errors.to?.message,
      testId: selectors.components.TimePicker.toField,
    },
  ];

  return (
    <div className={style.formView}>
      {fields.map(({ id, label, field, error, testId }) => (
        <Stack key={id} gap={0}>
          <Field label={label} invalid={!!error} error={error} className={style.field}>
            <Input
              id={id}
              autoComplete="off"
              value={field.value}
              onChange={(event) => field.onChange(event.currentTarget.value)}
              onBlur={field.onBlur}
              ref={field.ref}
              data-testid={testId}
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  onApply();
                }
              }}
              addonAfter={calendarButton}
            />
          </Field>
          {rangeUtil.isFiscal(value) && fyTooltip}
        </Stack>
      ))}
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
        <Button
          className={style.applyButton}
          data-testid={selectors.components.TimePicker.applyTimeRange}
          type="button"
          onClick={onApply}
        >
          <Trans i18nKey="time-picker.range-content.apply-button">Apply time range</Trans>
        </Button>
      </div>
    </div>
  );
};

function isRangeInvalid(from: string, to: string, timezone?: string): boolean {
  const raw: RawTimeRange = { from, to };
  const timeRange = rangeUtil.convertRawToRange(raw, timezone);
  const valid = timeRange.from.isSame(timeRange.to) || timeRange.from.isBefore(timeRange.to);

  return !valid;
}

function valueAsString(value: DateTime | string, timeZone?: TimeZone): string {
  if (isDateTime(value)) {
    return dateTimeFormat(value, { timeZone });
  }

  if (value.endsWith('Z')) {
    const dt = dateTimeParse(value);
    return dateTimeFormat(dt, { timeZone });
  }

  return value;
}

function getStyles(theme: GrafanaTheme2) {
  return {
    buttonsContainer: css({
      display: 'flex',
      gap: theme.spacing(0.5),
      marginTop: theme.spacing(1),
    }),
    applyButton: css({
      marginLeft: 'auto',
    }),
    field: css({
      flexGrow: 1,
      minWidth: 0,
    }),
    formView: css({
      padding: '0 9px',
    }),
    footer: css({
      padding: theme.spacing(0, 1, 0.5),
    }),
    calendar: css({
      margin: theme.spacing(0.5, 1, 0),
      padding: theme.spacing(0.5),
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
      '& .react-calendar': {
        width: '100%',
      },
    }),
    tooltip: css({
      paddingLeft: theme.spacing(1),
      paddingTop: theme.spacing(3),
    }),
  };
}
