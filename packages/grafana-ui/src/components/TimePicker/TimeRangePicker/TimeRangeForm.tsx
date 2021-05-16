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
import { css } from '@emotion/css';
import { useStyles2 } from '../../../themes/ThemeContext';

const getStyles = () => {
  return {
    saveRangeContainer: css`
      margin-top: 15px;
    `,
    withRightMargin: css`
      margin-right: 10px;
    `,
  };
};

interface Props {
  isFullscreen: boolean;
  value: TimeRange;
  onApply: (range: TimeRange) => void;
  timeZone?: TimeZone;
  roundup?: boolean;
  isReversed?: boolean;
}

export interface InputState {
  value: string;
  invalid: boolean;
}

const errorMessage = 'Please enter a past date or "now"';
const timeRangeStoreKey = 'timeRangeStoreKey';

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

  const onSaveToStorage = useCallback(
    (e: FormEvent<HTMLButtonElement>) => {
      e.preventDefault();
      if (to.invalid || from.invalid) {
        return;
      }

      const raw: RawTimeRange = { from: from.value, to: to.value };
      window.localStorage[timeRangeStoreKey] = JSON.stringify(raw);
      alert('Saved!');
    },
    [from.invalid, from.value, to.invalid, to.value]
  );

  const onRestoreFromStorage = useCallback(
    (e: FormEvent<HTMLButtonElement>) => {
      e.preventDefault();

      const rawTimeRangeAsJson = window.localStorage[timeRangeStoreKey];
      if (rawTimeRangeAsJson == null) {
        return;
      }
      const raw: RawTimeRange = JSON.parse(rawTimeRangeAsJson);

      setFrom(valueToState(raw.from, false, timeZone));
      setTo(valueToState(raw.to, true, timeZone));
    },
    [timeZone]
  );

  const onChange = useCallback(
    (from: DateTime, to: DateTime) => {
      setFrom(valueToState(from, false, timeZone));
      setTo(valueToState(to, true, timeZone));
    },
    [timeZone]
  );

  const icon = isFullscreen ? null : <Button icon="calendar-alt" variant="secondary" onClick={onOpen} />;

  const styles = useStyles2(getStyles);

  return (
    <>
      <Field label="From" invalid={from.invalid} error={errorMessage}>
        <Input
          onClick={(event) => event.stopPropagation()}
          onFocus={onFocus}
          onChange={(event) => setFrom(eventToState(event, false, timeZone))}
          addonAfter={icon}
          aria-label={selectors.components.TimePicker.fromField}
          value={from.value}
        />
      </Field>
      <Field label="To" invalid={to.invalid} error={errorMessage}>
        <Input
          onClick={(event) => event.stopPropagation()}
          onFocus={onFocus}
          onChange={(event) => setTo(eventToState(event, true, timeZone))}
          addonAfter={icon}
          aria-label={selectors.components.TimePicker.toField}
          value={to.value}
        />
      </Field>
      <Button aria-label={selectors.components.TimePicker.applyTimeRange} onClick={onApply}>
        Apply time range
      </Button>
      <div className={styles.saveRangeContainer}>
        <Button
          className={styles.withRightMargin}
          variant="secondary"
          aria-label={selectors.components.TimePicker.saveToStorage}
          onClick={onSaveToStorage}
          size="sm"
        >
          Save to storage
        </Button>
        <Button
          variant="secondary"
          aria-label={selectors.components.TimePicker.restoreFromStorage}
          onClick={onRestoreFromStorage}
          size="sm"
        >
          Restore from storage
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
