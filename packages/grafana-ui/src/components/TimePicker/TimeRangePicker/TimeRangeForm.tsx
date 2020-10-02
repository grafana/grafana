import React, { FormEvent, useState, useCallback, useEffect } from 'react';
import {
  TimeZone,
  isDateTime,
  TimeRange,
  DateTime,
  dateMath,
  dateTimeFormat,
  dateTimeParse,
  rangeUtil,
  RawTimeRange,
} from '@grafana/data';
import { TimePickerCalendar } from './TimePickerCalendar';
import { Field } from '../../Forms/Field';
import { Input } from '../../Input/Input';
import { Button } from '../../Button';

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

export const TimeRangeForm: React.FC<Props> = props => {
  const { value, isFullscreen = false, timeZone, roundup } = props;

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

      props.onApply(timeRange);
    },
    [from, to, roundup, timeZone]
  );

  const onChange = useCallback(
    (from: DateTime, to: DateTime) => {
      setFrom(valueToState(from, false, timeZone));
      setTo(valueToState(to, true, timeZone));
    },
    [timeZone]
  );

  const icon = isFullscreen ? null : <Button icon="calendar-alt" variant="secondary" onClick={onOpen} />;

  return (
    <>
      <Field label="From" invalid={from.invalid} error={errorMessage}>
        <Input
          onClick={event => event.stopPropagation()}
          onFocus={onFocus}
          onChange={event => setFrom(eventToState(event, false, timeZone))}
          addonAfter={icon}
          aria-label="TimePicker from field"
          value={from.value}
        />
      </Field>
      <Field label="To" invalid={to.invalid} error={errorMessage}>
        <Input
          onClick={event => event.stopPropagation()}
          onFocus={onFocus}
          onChange={event => setTo(eventToState(event, true, timeZone))}
          addonAfter={icon}
          aria-label="TimePicker to field"
          value={to.value}
        />
      </Field>
      <Button aria-label="TimePicker submit button" onClick={onApply}>
        Apply time range
      </Button>

      <TimePickerCalendar
        isFullscreen={isFullscreen}
        isOpen={isOpen}
        from={dateTimeParse(from.value, { timeZone })}
        to={dateTimeParse(to.value, { timeZone })}
        onApply={onApply}
        onClose={() => setOpen(false)}
        onChange={onChange}
        timeZone={timeZone}
        isReversed={props.isReversed}
      />
    </>
  );
};

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
