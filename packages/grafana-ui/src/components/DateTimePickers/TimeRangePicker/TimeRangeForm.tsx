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
}

const errorMessage = 'Please enter a past date or "now"';

export const TimeRangeForm: React.FC<Props> = (props) => {
  const { value, isFullscreen = false, timeZone, onApply: onApplyFromProps, isReversed } = props;

  const [from, setFrom] = useState<InputState>(valueToState(value.raw.from, false, timeZone));
  const [to, setTo] = useState<InputState>(valueToState(value.raw.to, true, timeZone));
  const [isOpen, setOpen] = useState(false);

  // Synchronize internal state with external value
  useEffect(() => {
    setFrom(valueToState(value.raw.from, false, timeZone));
    setTo(valueToState(value.raw.to, true, timeZone));
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
    (from: DateTime, to: DateTime) => {
      setFrom(valueToState(from, false, timeZone));
      setTo(valueToState(to, true, timeZone));
    },
    [timeZone]
  );

  const onFromChange = useCallback(
    (event: FormEvent<HTMLInputElement>) => {
      const newState = eventToState(event, false, timeZone);
      const invalid = validateRange(newState, to, timeZone);

      newState.invalid = newState.invalid || invalid;
      setFrom(newState);
    },
    [timeZone, to, setFrom]
  );

  const onToChange = useCallback(
    (event: FormEvent<HTMLInputElement>) => {
      const newState = eventToState(event, false, timeZone);
      const invalid = validateRange(from, newState, timeZone);

      setFrom({ value: from.value, invalid: invalid || !isValid(from.value, false, timeZone) });
      setTo(newState);
    },
    [timeZone, from, setFrom, setTo]
  );

  const icon = isFullscreen ? null : <Button icon="calendar-alt" variant="secondary" onClick={onOpen} />;

  return (
    <>
      <Field label="From" invalid={from.invalid} error={errorMessage}>
        <Input
          onClick={(event) => event.stopPropagation()}
          onFocus={onFocus}
          onChange={onFromChange}
          addonAfter={icon}
          aria-label={selectors.components.TimePicker.fromField}
          value={from.value}
        />
      </Field>
      <Field label="To" invalid={to.invalid} error={errorMessage}>
        <Input
          onClick={(event) => event.stopPropagation()}
          onFocus={onFocus}
          onChange={onToChange}
          addonAfter={icon}
          aria-label={selectors.components.TimePicker.toField}
          value={to.value}
        />
      </Field>
      <Button aria-label={selectors.components.TimePicker.applyTimeRange} onClick={onApply}>
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
    </>
  );
};

function validateRange(from: InputState, to: InputState, timezone?: string): boolean {
  const raw: RawTimeRange = { from: from.value, to: to.value };
  const timeRange = rangeUtil.convertRawToRange(raw, timezone);
  const valid = timeRange.from.isSame(timeRange.to) || timeRange.from.isBefore(timeRange.to);

  return !valid;
}

function eventToState(event: FormEvent<HTMLInputElement>, roundup?: boolean, timeZone?: TimeZone): InputState {
  return valueToState(event.currentTarget.value, roundup, timeZone);
}

function valueToState(raw: DateTime | string, roundup?: boolean, timeZone?: TimeZone): InputState {
  const value = valueAsString(raw, timeZone);
  const invalid = !isValid(value, roundup, timeZone);
  return { value, invalid };
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
