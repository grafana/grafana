import {
  dateMath,
  DateTime,
  dateTimeFormat,
  dateTimeParse,
  isDateTime,
  rangeUtil,
  RawTimeRange,
  TimeRange,
  TimeZone,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import React, { FormEvent, useCallback, useEffect, useState } from 'react';
import { Button } from '../../Button';
import { Field } from '../../Forms/Field';
import { Input } from '../../Input/Input';
import { TimePickerCalendar } from './TimePickerCalendar';

interface Props {
  isFullscreen: boolean;
  value: TimeRange;
  onApply: (range: TimeRange) => void;
  timeZone?: TimeZone;
  roundup?: boolean;
  isReversed?: boolean;
}

interface InputState {
  value: string;
  invalid: boolean;
  errorMessage: string;
}

const ERROR_MESSAGES = {
  default: 'Please enter a past date or "now"',
  range: '"From" can\'t be after "To"',
};

export const TimeRangeForm: React.FC<Props> = (props) => {
  const { value, isFullscreen = false, timeZone, onApply: onApplyFromProps, isReversed } = props;
  const [fromValue, toValue] = valueToState(value.raw.from, value.raw.to, timeZone);

  const [from, setFrom] = useState<InputState>(fromValue);
  const [to, setTo] = useState<InputState>(toValue);
  const [isOpen, setOpen] = useState(false);

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

  const onFocus = useCallback(
    (event: FormEvent<HTMLElement>) => {
      if (!isFullscreen) {
        return;
      }
      onOpen(event);
    },
    [isFullscreen, onOpen]
  );

  const onApply = useCallback(
    (e: FormEvent<HTMLButtonElement>) => {
      e.preventDefault();
      if (to.invalid || from.invalid) {
        return;
      }

      const raw: RawTimeRange = { from: from.value, to: to.value };
      const timeRange = rangeUtil.convertRawToRange(raw, timeZone);

      onApplyFromProps(timeRange);
    },
    [from.invalid, from.value, onApplyFromProps, timeZone, to.invalid, to.value]
  );

  const onChange = useCallback(
    (from: DateTime | string, to: DateTime | string) => {
      const [fromValue, toValue] = valueToState(from, to, timeZone);
      setFrom(fromValue);
      setTo(toValue);
    },
    [timeZone]
  );

  const icon = isFullscreen ? null : <Button icon="calendar-alt" variant="secondary" onClick={onOpen} />;

  return (
    <div aria-label="Absolute time ranges">
      <Field label="From" invalid={from.invalid} error={from.errorMessage}>
        <Input
          onClick={(event) => event.stopPropagation()}
          onFocus={onFocus}
          onChange={(event) => onChange(event.currentTarget.value, to.value)}
          addonAfter={icon}
          aria-label={selectors.components.TimePicker.fromField}
          value={from.value}
        />
      </Field>
      <Field label="To" invalid={to.invalid} error={to.errorMessage}>
        <Input
          onClick={(event) => event.stopPropagation()}
          onFocus={onFocus}
          onChange={(event) => onChange(from.value, event.currentTarget.value)}
          addonAfter={icon}
          aria-label={selectors.components.TimePicker.toField}
          value={to.value}
        />
      </Field>
      <Button data-testid={selectors.components.TimePicker.applyTimeRange} onClick={onApply}>
        Apply time range
      </Button>

      <TimePickerCalendar
        isFullscreen={isFullscreen}
        isOpen={isOpen}
        from={dateTimeParse(from.value)}
        to={dateTimeParse(to.value)}
        onApply={onApply}
        onClose={() => setOpen(false)}
        onChange={onChange}
        timeZone={timeZone}
        isReversed={isReversed}
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

  return [
    {
      value: fromValue,
      invalid: fromInvalid || rangeInvalid,
      errorMessage: rangeInvalid && !fromInvalid ? ERROR_MESSAGES.range : ERROR_MESSAGES.default,
    },
    { value: toValue, invalid: toInvalid, errorMessage: ERROR_MESSAGES.default },
  ];
}

function valueAsString(value: DateTime | string, timeZone?: TimeZone): string {
  if (isDateTime(value)) {
    return dateTimeFormat(value, { timeZone });
  }
  return value;
}

function isValid(value: string, roundUp?: boolean, timeZone?: TimeZone): boolean {
  if (isDateTime(value)) {
    return value.isValid();
  }

  if (dateMath.isMathString(value)) {
    return dateMath.isValid(value);
  }

  const parsed = dateTimeParse(value, { roundUp, timeZone });
  return parsed.isValid();
}
