import { css } from '@emotion/css';
import { type KeyboardEvent, useCallback, useEffect } from 'react';
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
import { Icon } from '../../Icon/Icon';
import { Tooltip } from '../../Tooltip/Tooltip';
import { type WeekStart } from '../WeekStartPicker';
import { isValid } from '../utils';

import { TimeRangeFields } from './TimeRangeFields';

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

  return (
    <div>
      <TimeRangeFields
        fromError={errors.from?.message}
        toError={errors.to?.message}
        fieldSuffix={fyTooltip}
        fromInput={{
          ...register('from', {
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
          }),
          onClick: (event) => event.stopPropagation(),
          onKeyDown: submitOnEnter,
          'data-testid': selectors.components.TimePicker.fromField,
        }}
        toInput={{
          ...register('to', {
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
          }),
          onClick: (event) => event.stopPropagation(),
          onKeyDown: submitOnEnter,
          'data-testid': selectors.components.TimePicker.toField,
        }}
        calendar={{
          isFullscreen,
          from: dateTimeParse(watch('from'), { timeZone }),
          to: dateTimeParse(watch('to'), { timeZone }),
          onApply,
          onChange,
          timeZone,
          isReversed,
          weekStart,
        }}
      />
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
    tooltip: css({
      paddingLeft: theme.spacing(1),
      paddingTop: theme.spacing(3),
    }),
  };
}
