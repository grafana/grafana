import React, { FormEvent, useState } from 'react';
import { TIME_FORMAT, TimeZone, isDateTime, TimeRange, DateTime } from '@grafana/data';
import { stringToDateTimeType, isValidTimeString } from '../time';
import { mapStringsToTimeRange } from './mapper';
import TimePickerCalendar from './TimePickerCalendar';
import Forms from '../../Forms';

type ShowCalendarOn = 'ClickOnInputButton' | 'FocusOnInput';

interface Props {
  showCalendarOn: ShowCalendarOn;
  value: TimeRange;
  onApply: (range: TimeRange) => void;
  timeZone?: TimeZone;
}

interface InputState {
  value: string;
  invalid: boolean;
}

const errorMessage = 'Please enter a past date or "now"';

const TimePickerForm: React.FC<Props> = props => {
  const { value, showCalendarOn, timeZone } = props;
  const isFullscreen = showCalendarOn === 'FocusOnInput';

  const [from, setFrom] = useState<InputState>(valueToState(value.to, false, timeZone));
  const [to, setTo] = useState<InputState>(valueToState(value.from, true, timeZone));
  const [isOpen, setOpen] = useState(false);

  const onOpen = (event: FormEvent<HTMLElement>) => {
    event.preventDefault();
    setOpen(true);
  };

  const onFocus = (event: FormEvent<HTMLElement>) => {
    if (!isFullscreen) {
      return;
    }
    onOpen(event);
  };

  const onApply = () => {
    if (to.invalid || from.invalid) {
      return;
    }
    props.onApply(mapStringsToTimeRange(from.value, to.value));
  };

  const icon = isFullscreen ? null : <Forms.Button icon="fa fa-calendar" variant="secondary" onClick={onOpen} />;

  return (
    <>
      <Forms.Field label="From" invalid={from.invalid} error={errorMessage}>
        <Forms.Input
          onFocus={onFocus}
          onChange={event => setFrom(eventToState(event, false, timeZone))}
          addonAfter={icon}
          value={from.value}
        />
      </Forms.Field>
      <Forms.Field label="To" invalid={to.invalid} error={errorMessage}>
        <Forms.Input
          onFocus={onFocus}
          onChange={event => setTo(eventToState(event, true, timeZone))}
          addonAfter={icon}
          value={to.value}
        />
      </Forms.Field>
      <Forms.Button onClick={onApply}>Apply time interval</Forms.Button>

      <TimePickerCalendar
        isFullscreen={isFullscreen}
        isOpen={isOpen}
        from={from.value}
        to={to.value}
        onApply={onApply}
        onClose={() => setOpen(false)}
        onChange={(from, to) => {
          setFrom(valueToState(from, false, timeZone));
          setTo(valueToState(to, true, timeZone));
        }}
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
  if (value.indexOf('now') !== -1) {
    return isValidTimeString(value);
  }

  const parsed = stringToDateTimeType(value, roundup, timeZone);
  return parsed.isValid();
}

export default TimePickerForm;
