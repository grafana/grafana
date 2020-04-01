import React, { FormEvent, useState, useCallback } from 'react';
import { TIME_FORMAT, TimeZone, isDateTime, TimeRange, DateTime, dateMath } from '@grafana/data';
import { stringToDateTimeType, isValidTimeString } from '../time';
import { mapStringsToTimeRange } from './mapper';
import { TimePickerCalendar } from './TimePickerCalendar';
import Forms from '../../Forms';
import { Button } from '../../Button';

interface Props {
  isFullscreen: boolean;
  value: TimeRange;
  onApply: (range: TimeRange) => void;
  timeZone?: TimeZone;
  roundup?: boolean;
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

  const onApply = useCallback(() => {
    if (to.invalid || from.invalid) {
      return;
    }
    props.onApply(mapStringsToTimeRange(from.value, to.value, roundup, timeZone));
  }, [from, to, roundup, timeZone]);

  const onChange = useCallback(
    (from: string, to: string) => {
      setFrom(valueToState(from, false, timeZone));
      setTo(valueToState(to, true, timeZone));
    },
    [timeZone]
  );

  const icon = isFullscreen ? null : <Button icon="fa fa-calendar" variant="secondary" onClick={onOpen} />;

  return (
    <>
      <Forms.Field label="From" invalid={from.invalid} error={errorMessage}>
        <Forms.Input
          onClick={event => event.stopPropagation()}
          onFocus={onFocus}
          onChange={event => setFrom(eventToState(event, false, timeZone))}
          addonAfter={icon}
          value={from.value}
        />
      </Forms.Field>
      <Forms.Field label="To" invalid={to.invalid} error={errorMessage}>
        <Forms.Input
          onClick={event => event.stopPropagation()}
          onFocus={onFocus}
          onChange={event => setTo(eventToState(event, true, timeZone))}
          addonAfter={icon}
          value={to.value}
        />
      </Forms.Field>
      <Button onClick={onApply}>Apply time range</Button>

      <TimePickerCalendar
        isFullscreen={isFullscreen}
        isOpen={isOpen}
        from={from.value}
        to={to.value}
        onApply={onApply}
        onClose={() => setOpen(false)}
        onChange={onChange}
      />
    </>
  );
};

function eventToState(event: FormEvent<HTMLInputElement>, roundup?: boolean, timeZone?: TimeZone): InputState {
  return valueToState(event.currentTarget.value, roundup, timeZone);
}

function valueToState(raw: DateTime | string, roundup?: boolean, timeZone?: TimeZone): InputState {
  const value = valueAsString(raw);
  const invalid = !isValid(value, roundup, timeZone);
  return { value, invalid };
}

function valueAsString(value: DateTime | string): string {
  if (isDateTime(value)) {
    return value.format(TIME_FORMAT);
  }
  return value;
}

function isValid(value: string, roundup?: boolean, timeZone?: TimeZone): boolean {
  if (dateMath.isMathString(value)) {
    return isValidTimeString(value);
  }

  const parsed = stringToDateTimeType(value, roundup, timeZone);
  return parsed.isValid();
}
