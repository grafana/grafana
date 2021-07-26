import React, { ChangeEvent } from 'react';
import { css } from '@emotion/css';
import { dateTimeFormat } from '@grafana/data';
import { DatePicker } from '../DatePicker/DatePicker';
import { Props as InputProps, Input } from '../../Input/Input';
import { useStyles } from '../../../themes';

export const formatDate = (date: Date | string) => dateTimeFormat(date, { format: 'L' });

/** @public */
export interface DatePickerWithInputProps extends Omit<InputProps, 'ref' | 'value' | 'onChange'> {
  value?: Date | string;
  onChange: (value: Date | string) => void;
  /** Hide the calendar when date is selected */
  closeOnSelect?: boolean;
  placeholder?: string;
}

/** @public */
export const DatePickerWithInput = ({
  value,
  onChange,
  closeOnSelect,
  placeholder = 'Date',
  ...rest
}: DatePickerWithInputProps) => {
  const [open, setOpen] = React.useState(false);
  const styles = useStyles(getStyles);

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
        value={value && typeof value !== 'string' ? value : new Date()}
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
