import { css } from '@emotion/css';
import { FormEvent, useCallback, useEffect, useId, useRef, useState } from 'react';
import * as React from 'react';

import {
  DateTime,
  dateTimeFormat,
  dateTimeParse,
  GrafanaTheme2,
  isDateTime,
  rangeUtil,
  RawTimeRange,
  TimeRange,
  TimeZone,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t, Trans } from '@grafana/i18n';

import { useStyles2 } from '../../../themes/ThemeContext';
import { Button } from '../../Button/Button';
import { Field } from '../../Forms/Field';
import { FieldValidationMessage } from '../../Forms/FieldValidationMessage';
import { Icon } from '../../Icon/Icon';
import { Input } from '../../Input/Input';
import { TextLink } from '../../Link/TextLink';
import { Tooltip } from '../../Tooltip/Tooltip';
import { WeekStart } from '../WeekStartPicker';
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

interface InputState {
  value: string;
  invalid: boolean;
  // Visual error content — rendered inside aria-hidden wrapper so role="alert" is suppressed
  errorMessage: React.ReactNode;
  // Plain-text error — rendered in polite live region and linked via aria-describedby
  errorDescription: string;
}

const DOCS_LINK = 'https://grafana.com/docs/grafana/latest/dashboards/time-range-controls';

const ERROR_MESSAGES = {
  from: {
    description: () =>
      t(
        'time-picker.range-content.from-error',
        'Enter a date (YYYY-MM-DD HH:mm:ss) or relative time (e.g. now, now-1h) in the From field.'
      ),
  },
  to: {
    description: () =>
      t(
        'time-picker.range-content.to-error',
        'Enter a date (YYYY-MM-DD HH:mm:ss) or relative time (e.g. now, now-1h) in the To field.'
      ),
  },
  range: {
    description: () => t('time-picker.range-content.range-error', '"From" date must be before "To"'),
  },
};

function fieldErrorMessage(type: 'from' | 'to' | 'range'): React.ReactNode {
  const desc = ERROR_MESSAGES[type].description();
  if (type === 'range') {
    return desc;
  }
  return (
    <>
      {desc}{' '}
      <TextLink href={DOCS_LINK} external>
        {t('time-picker.range-content.error-see-docs', 'See time range syntax')}
      </TextLink>
    </>
  );
}

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
  const [fromValue, toValue] = valueToState(value.raw.from, value.raw.to, timeZone);
  const style = useStyles2(getStyles);

  const [from, setFrom] = useState<InputState>(fromValue);
  const [to, setTo] = useState<InputState>(toValue);
  const [isOpen, setOpen] = useState(false);

  const fromInputRef = useRef<HTMLInputElement>(null);
  const toInputRef = useRef<HTMLInputElement>(null);

  const fromFieldId = useId();
  const toFieldId = useId();
  // IDs for the polite live regions — linked to inputs via aria-describedby
  const fromErrorId = `${fromFieldId}-error`;
  const toErrorId = `${toFieldId}-error`;

  // Synchronize internal state with external value
  useEffect(() => {
    const [fromValue, toValue] = valueToState(value.raw.from, value.raw.to, timeZone);
    setFrom(fromValue);
    setTo(toValue);
  }, [value.raw.from, value.raw.to, timeZone]);

  const onOpen = useCallback(
    (event: FormEvent<HTMLElement>) => {
      event.preventDefault();
      setOpen(true);
    },
    [setOpen]
  );

  const onApply = useCallback(() => {
    if (to.invalid || from.invalid) {
      // Focus first invalid field — aria-describedby will announce the error naturally
      if (from.invalid) {
        fromInputRef.current?.focus();
      } else {
        toInputRef.current?.focus();
      }
      return;
    }

    const raw: RawTimeRange = { from: from.value, to: to.value };
    const timeRange = rangeUtil.convertRawToRange(raw, timeZone, fiscalYearStartMonth, commonFormat);

    onApplyFromProps(timeRange);
  }, [from.invalid, from.value, onApplyFromProps, timeZone, to.invalid, to.value, fiscalYearStartMonth]);

  const onChange = useCallback(
    (from: DateTime | string, to: DateTime | string) => {
      const [fromValue, toValue] = valueToState(from, to, timeZone);
      setFrom(fromValue);
      setTo(toValue);
    },
    [timeZone]
  );

  const submitOnEnter = (event: React.KeyboardEvent<HTMLInputElement>) => {
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

    const [fromValue, toValue] = valueToState(range.from, range.to, timeZone);
    setFrom(fromValue);
    setTo(toValue);
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
        {/*
         * Field does not receive `error` — that would render FieldValidationMessage with role="alert"
         * (assertive), which interrupts speech on every keystroke. Instead we:
         *   1. Render FieldValidationMessage inside aria-hidden (visual only, no live region)
         *   2. Render a role="status" (polite) live region for screen reader announcements
         *   3. Link the input to the polite region via aria-describedby
         */}
        <div className={style.fieldWrapper}>
          <Field
            label={t('time-picker.range-content.from-input', 'From')}
            invalid={from.invalid}
            noMargin={from.invalid}
          >
            <Input
              id={fromFieldId}
              ref={fromInputRef}
              aria-invalid={from.invalid || undefined}
              aria-describedby={from.invalid ? fromErrorId : undefined}
              onClick={(event) => event.stopPropagation()}
              onChange={(event) => onChange(event.currentTarget.value, to.value)}
              addonAfter={icon}
              onKeyDown={submitOnEnter}
              data-testid={selectors.components.TimePicker.fromField}
              value={from.value}
            />
          </Field>
          {from.invalid && (
            <div aria-hidden="true" className={style.fieldValidationWrapper}>
              <FieldValidationMessage>{from.errorMessage}</FieldValidationMessage>
            </div>
          )}
          {/* Polite live region — announces without interrupting; also the aria-describedby target */}
          <div id={fromErrorId} role="status" className={style.srOnly}>
            {from.invalid ? from.errorDescription : ''}
          </div>
        </div>
        {fyTooltip}
      </div>
      <div className={style.fieldContainer}>
        <div className={style.fieldWrapper}>
          <Field label={t('time-picker.range-content.to-input', 'To')} invalid={to.invalid} noMargin={to.invalid}>
            <Input
              id={toFieldId}
              ref={toInputRef}
              aria-invalid={to.invalid || undefined}
              aria-describedby={to.invalid ? toErrorId : undefined}
              onClick={(event) => event.stopPropagation()}
              onChange={(event) => onChange(from.value, event.currentTarget.value)}
              addonAfter={icon}
              onKeyDown={submitOnEnter}
              data-testid={selectors.components.TimePicker.toField}
              value={to.value}
            />
          </Field>
          {to.invalid && (
            <div aria-hidden="true" className={style.fieldValidationWrapper}>
              <FieldValidationMessage>{to.errorMessage}</FieldValidationMessage>
            </div>
          )}
          <div id={toErrorId} role="status" className={style.srOnly}>
            {to.invalid ? to.errorDescription : ''}
          </div>
        </div>
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
        from={dateTimeParse(from.value, { timeZone })}
        to={dateTimeParse(to.value, { timeZone })}
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
  const timeRange = rangeUtil.convertRawToRange(raw, timezone, undefined, commonFormat);
  const valid = timeRange.from.isSame(timeRange.to) || timeRange.from.isBefore(timeRange.to);

  return !valid;
}

function valueToState(
  rawFrom: DateTime | string,
  rawTo: DateTime | string,
  timeZone?: TimeZone
): [InputState, InputState] {
  const fromValue = valueAsString(rawFrom, timeZone);
  const toValue = valueAsString(rawTo, timeZone);
  const fromInvalid = !isValid(fromValue, false, timeZone);
  const toInvalid = !isValid(toValue, true, timeZone);
  // If "To" is invalid, we should not check the range anyways
  const rangeInvalid = isRangeInvalid(fromValue, toValue, timeZone) && !toInvalid;

  const fromErrorType = rangeInvalid && !fromInvalid ? 'range' : 'from';
  return [
    {
      value: fromValue,
      invalid: fromInvalid || rangeInvalid,
      errorMessage: fieldErrorMessage(fromErrorType),
      errorDescription: ERROR_MESSAGES[fromErrorType].description(),
    },
    {
      value: toValue,
      invalid: toInvalid,
      errorMessage: fieldErrorMessage('to'),
      errorDescription: ERROR_MESSAGES.to.description(),
    },
  ];
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
    fieldWrapper: css({
      flex: 1,
    }),
    fieldValidationWrapper: css({
      marginTop: theme.spacing(0.5),
      marginBottom: theme.spacing(2),
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
    srOnly: css({
      position: 'absolute',
      width: '1px',
      height: '1px',
      padding: 0,
      margin: '-1px',
      overflow: 'hidden',
      clip: 'rect(0, 0, 0, 0)',
      whiteSpace: 'nowrap',
      border: 0,
    }),
  };
}
