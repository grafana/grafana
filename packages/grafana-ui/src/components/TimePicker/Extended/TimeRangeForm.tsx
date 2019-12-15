import React, { FormEvent, useState, memo } from 'react';
import { TIME_FORMAT, TimeZone, isDateTime, TimeRange, DateTime } from '@grafana/data';
import { stringToDateTimeType, isValidTimeString } from '../time';
import TimePickerCalendar from './TimePickerCalendar';
import Forms from '../../Forms';

type ShowCalendarOn = 'ClickOnInputButton' | 'FocusOnInput';

interface Props {
  showCalendarOn: ShowCalendarOn;
  value: TimeRange;
  onApply: (range: TimeRange) => void;
}
interface InputState {
  value: string;
  invalid: boolean;
}

const TimePickerForm: React.FC<Props> = props => {
  const { value, showCalendarOn } = props;
  const isFullscreen = showCalendarOn === 'FocusOnInput';

  const [from, setFrom] = useState<InputState>(valueToState(value.to));
  const [to, setTo] = useState<InputState>(valueToState(value.from));
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
    props.onApply(toTimeRange(from.value, to.value));
  };

  const icon = isFullscreen ? null : <Forms.Button icon="fa fa-calendar" variant="secondary" onClick={onOpen} />;

  return (
    <>
      <Forms.Field label="From">
        <Forms.Input
          onClick={onOpen}
          onFocus={onFocus}
          invalid={from.invalid}
          onChange={event => setFrom(eventToState(event))}
          addonAfter={icon}
          value={from.value}
        />
      </Forms.Field>
      <Forms.Field label="To">
        <Forms.Input
          onClick={onOpen}
          onFocus={onFocus}
          invalid={to.invalid}
          onChange={event => setTo(eventToState(event))}
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
          setFrom(valueToState(from));
          setTo(valueToState(to));
        }}
      />
    </>
  );
};

function toTimeRange(from: string, to: string): TimeRange {
  const fromDate = stringToDateTimeType(from);
  const toDate = stringToDateTimeType(from);

  return {
    from: fromDate,
    to: toDate,
    raw: {
      from: fromDate,
      to: toDate,
    },
  };
}

function eventToState(event: FormEvent<HTMLInputElement>): InputState {
  return valueToState(event.currentTarget.value);
}

function valueToState(raw: DateTime | string): InputState {
  const value = valueAsString(raw);
  return { value, invalid: !isValid(value) };
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

export default memo(TimePickerForm);
