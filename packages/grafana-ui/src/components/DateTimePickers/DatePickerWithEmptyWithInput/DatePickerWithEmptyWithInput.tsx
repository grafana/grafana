import React, { ChangeEvent } from 'react';
import { css } from '@emotion/css';
import { dateTime } from '@grafana/data';
import { DatePickerWithEmpty } from '../DatePickerWithEmpty/DatePickerWithEmpty';
import { Props as InputProps, Input } from '../../Input/Input';
import { useStyles } from '../../../themes';

export const formatDate = (date: Date | string) => dateTime(date).format('L');

/** @public */
export interface DatePickerWithEmptyWithInputProps extends Omit<InputProps, 'ref' | 'value' | 'onChange'> {
  value?: Date | string;
  onChange: (value: Date | string, isDateInput: boolean) => void;
  isDateInput: boolean;
  returnValue: 'start' | 'end';
  closeOnSelect?: boolean;
  placeholder?: string;
}

/** @public */
export const DatePickerWithEmptyWithInput = ({
  value,
  onChange,
  isDateInput,
  returnValue,
  closeOnSelect,
  placeholder = 'Date',
  ...rest
}: DatePickerWithEmptyWithInputProps) => {
  const [open, setOpen] = React.useState(false);
  const styles = useStyles(getStyles);

  return (
    <div className={styles.container}>
      <Input
        type="text"
        autoComplete={'off'}
        placeholder={placeholder}
        value={isDateInput ? (value ? formatDate(value) : value) : ''}
        onClick={() => setOpen(true)}
        onChange={(ev: ChangeEvent<HTMLInputElement>) => {
          // Allow resetting the date
          if (ev.target.value === '') {
            onChange(value ? value : new Date(), false);
          }
        }}
        className={styles.input}
        {...rest}
      />
      <DatePickerWithEmpty
        isOpen={open}
        value={value && typeof value !== 'string' ? value : dateTime().toDate()}
        onChange={(ev, isDateInput) => {
          onChange(ev, isDateInput);
          if (closeOnSelect) {
            setOpen(false);
          }
        }}
        onClose={() => setOpen(false)}
        isDateInput={isDateInput}
        returnValue={returnValue}
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
