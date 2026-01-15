import { css } from '@emotion/css';
import { autoUpdate, useClick, useDismiss, useFloating, useInteractions } from '@floating-ui/react';
import { ChangeEvent, forwardRef, useImperativeHandle, useState } from 'react';

import { GrafanaTheme2, dateTime } from '@grafana/data';

import { useStyles2 } from '../../../themes/ThemeContext';
import { getPositioningMiddleware } from '../../../utils/floating';
import { Props as InputProps, Input } from '../../Input/Input';
import { DatePicker } from '../DatePicker/DatePicker';

export const formatDate = (date: Date | string) => dateTime(date).format('L');

/** @public */
export interface DatePickerWithInputProps extends Omit<InputProps, 'value' | 'onChange'> {
  /** Value selected by the DatePicker */
  value?: Date | string;
  /** The minimum date the value can be set to */
  minDate?: Date;
  /** The maximum date the value can be set to */
  maxDate?: Date;
  /** Handles changes when a new date is selected */
  onChange: (value: Date | string) => void;
  /** Hide the calendar when date is selected */
  closeOnSelect?: boolean;
  /** Text that appears when the input has no text */
  placeholder?: string;
}

/**
 * An input with a calendar view, used to select a date.
 *
 * https://developers.grafana.com/ui/latest/index.html?path=/docs/date-time-pickers-datepickerwithinput--docs
 * @public
 */
export const DatePickerWithInput = forwardRef<HTMLInputElement, DatePickerWithInputProps>(
  ({ value, minDate, maxDate, onChange, closeOnSelect, placeholder = 'Date', ...rest }, ref) => {
    const [open, setOpen] = useState(false);
    const styles = useStyles2(getStyles);
    const placement = 'bottom-start';

    // the order of middleware is important!
    // see https://floating-ui.com/docs/arrow#order
    const middleware = getPositioningMiddleware(placement);

    const { context, refs, floatingStyles } = useFloating<HTMLInputElement>({
      open,
      placement,
      onOpenChange: setOpen,
      middleware,
      whileElementsMounted: autoUpdate,
      strategy: 'fixed',
    });

    const click = useClick(context);
    const dismiss = useDismiss(context);
    const { getReferenceProps, getFloatingProps } = useInteractions([dismiss, click]);

    useImperativeHandle<HTMLInputElement | null, HTMLInputElement | null>(ref, () => refs.domReference.current, [
      refs.domReference,
    ]);

    return (
      <div className={styles.container}>
        <Input
          ref={refs.setReference}
          type="text"
          autoComplete={'off'}
          placeholder={placeholder}
          value={value ? formatDate(value) : value}
          onChange={(ev: ChangeEvent<HTMLInputElement>) => {
            // Allow resetting the date
            if (ev.target.value === '') {
              onChange('');
            }
          }}
          className={styles.input}
          {...rest}
          {...getReferenceProps()}
        />
        <div className={styles.popover} ref={refs.setFloating} style={floatingStyles} {...getFloatingProps()}>
          <DatePicker
            isOpen={open}
            value={value && typeof value !== 'string' ? value : dateTime().toDate()}
            minDate={minDate}
            maxDate={maxDate}
            onChange={(ev) => {
              onChange(ev);
              if (closeOnSelect) {
                setOpen(false);
              }
            }}
            onClose={() => setOpen(false)}
          />
        </div>
      </div>
    );
  }
);

DatePickerWithInput.displayName = 'DatePickerWithInput';

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css({
      position: 'relative',
    }),
    input: css({
      /* hides the native Calendar picker icon given when using type=date */
      "input[type='date']::-webkit-inner-spin-button, input[type='date']::-webkit-calendar-picker-indicator": {
        display: 'none',
        WebkitAppearance: 'none',
      },
    }),
    popover: css({
      zIndex: theme.zIndex.tooltip,
    }),
  };
};
