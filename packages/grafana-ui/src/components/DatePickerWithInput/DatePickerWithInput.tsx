import React from 'react';
import { DatePicker } from '../DatePicker/DatePicker';
import { Props as InputProps, Input } from '../Input/Input';
import { css } from '@emotion/css';
import { useStyles } from '../../themes';

export const formatDate = (date: Date) => date.toISOString().split('T')[0];

export interface DatePickerWithInputProps extends Omit<InputProps, 'ref' | 'value' | 'onChange'> {
  value?: Date;
  onChange: (value: Date) => void;
}

export const DatePickerWithInput = ({ value, onChange, ...rest }: DatePickerWithInputProps) => {
  const [open, setOpen] = React.useState(false);
  const styles = useStyles(getStyles);

  return (
    <>
      <Input
        type="date"
        placeholder="Date"
        value={formatDate(value || new Date())}
        onClick={() => setOpen(true)}
        onChange={() => {}}
        className={styles.input}
        {...rest}
      />
      <DatePicker isOpen={open} value={value} onChange={(ev) => onChange(ev)} onClose={() => setOpen(false)} />
    </>
  );
};

const getStyles = () => {
  return {
    input: css`
    /* hides the native Calendar picker icon given when using type=date */
    input[type='date']::-webkit-inner-spin-button,
    input[type='date']::-webkit-calendar-picker-indicator {
    display: none;
    -webkit-appearance: none;
    `,
  };
};
