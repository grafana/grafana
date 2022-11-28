import { css } from '@emotion/css';
import React, { ChangeEvent } from 'react';

import { dateTime } from '@grafana/data';

import { useStyles2 } from '../../../themes';
import { Props as InputProps, Input } from '../../Input/Input';
import { DatePicker } from '../DatePicker/DatePicker';

export const formatDate = (date: Date | string) => dateTime(date).format('L');

/** @public */
export interface DatePickerWithInputProps extends Omit<InputProps, 'ref' | 'value' | 'onChange'> {
  /** Value selected by the DatePicker */
  value?: Date | string;
  /** The minimum date the value can be set to */
  minDate?: Date;
  /** Handles changes when a new date is selected */
  onChange: (value: Date | string) => void;
  /** Hide the calendar when date is selected */
  closeOnSelect?: boolean;
  /** Text that appears when the input has no text */
  placeholder?: string;
}

/** @public */
export const DatePickerWithInput = ({
  value,
  minDate,
  onChange,
  closeOnSelect,
  placeholder = 'Date',
  ...rest
}: DatePickerWithInputProps) => {
  const [open, setOpen] = React.useState(false);
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.container}>
      <Input
        type="text"
        autoComplete={'off'}
        placeholder={placeholder}
        value={value ? formatDate(value) : value}
        onClick={() => setOpen(true)}
        onChange={(ev: ChangeEvent<HTMLInputElement>) => {
          // Allow resetting the date
          if (ev.target.value === '') {
            onChange('');
          }
        }}
        className={styles.input}
        {...rest}
      />
      <DatePicker
        isOpen={open}
        value={value && typeof value !== 'string' ? value : dateTime().toDate()}
        minDate={minDate}
        onChange={(ev) => {
          onChange(ev);
          if (closeOnSelect) {
            setOpen(false);
          }
        }}
        onClose={() => setOpen(false)}
      />
    </div>
  );
};

const getStyles = () => {
  return {
    container: css`
      position: relative;
    `,
    input: css`
    /* hides the native Calendar picker icon given when using type=date */
    input[type='date']::-webkit-inner-spin-button,
    input[type='date']::-webkit-calendar-picker-indicator {
    display: none;
    -webkit-appearance: none;
    `,
  };
};
