import { css, cx } from '@emotion/css';
import { autoUpdate, flip, shift, useFloating } from '@floating-ui/react';
import { useDialog } from '@react-aria/dialog';
import { FocusScope } from '@react-aria/focus';
import { useOverlay } from '@react-aria/overlays';
import React, { FormEvent, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Calendar from 'react-calendar';
import { useMedia } from 'react-use';

import { DateTime, dateTime, dateTimeFormat, dateTimeForTimeZone, getTimeZone, GrafanaTheme2 } from '@grafana/data';
import { Components } from '@grafana/e2e-selectors';

import { useStyles2, useTheme2 } from '../../../themes';
import { Button } from '../../Button/Button';
import { InlineField } from '../../Forms/InlineField';
import { Icon } from '../../Icon/Icon';
import { Input } from '../../Input/Input';
import { Stack } from '../../Layout/Stack/Stack';
import { getModalStyles } from '../../Modal/getModalStyles';
import { Portal } from '../../Portal/Portal';
import { POPUP_CLASS_NAME, TimeOfDayPicker } from '../TimeOfDayPicker';
import { getBodyStyles } from '../TimeRangePicker/CalendarBody';
import { useDateTimeFormat, useGetFormattedDate } from '../hooks';
import { isValid } from '../utils';

export interface Props {
  /** Input date for the component */
  date?: DateTime;
  /** Callback for returning the selected date */
  onChange: (date: DateTime) => void;
  /** label for the input field */
  label?: ReactNode;
  /** Set the latest selectable date */
  maxDate?: Date;
  /** Set the minimum selectable date */
  minDate?: Date;
  /** Display seconds on the time picker */
  showSeconds?: boolean;
  /** Set the hours that can't be selected */
  disabledHours?: () => number[];
  /** Set the minutes that can't be selected */
  disabledMinutes?: () => number[];
  /** Set the seconds that can't be selected */
  disabledSeconds?: () => number[];
}

export const DateTimePicker = ({
  date,
  maxDate,
  minDate,
  label,
  onChange,
  disabledHours,
  disabledMinutes,
  disabledSeconds,
  showSeconds = true,
}: Props) => {
  const [isOpen, setOpen] = useState(false);

  const ref = useRef<HTMLDivElement>(null);
  const { overlayProps, underlayProps } = useOverlay(
    {
      onClose: () => setOpen(false),
      isDismissable: true,
      isOpen,
      shouldCloseOnInteractOutside: (element) => {
        const popupElement = document.getElementsByClassName(POPUP_CLASS_NAME)[0];
        return !(popupElement && popupElement.contains(element));
      },
    },
    ref
  );
  const { dialogProps } = useDialog({}, ref);

  const theme = useTheme2();
  const { modalBackdrop } = useStyles2(getModalStyles);
  const isFullscreen = useMedia(`(min-width: ${theme.breakpoints.values.lg}px)`);
  const styles = useStyles2(getStyles);

  // the order of middleware is important!
  // see https://floating-ui.com/docs/arrow#order
  const middleware = [
    flip({
      // see https://floating-ui.com/docs/flip#combining-with-shift
      crossAxis: false,
      boundary: document.body,
    }),
    shift(),
  ];

  const { refs, floatingStyles } = useFloating({
    open: isOpen,
    placement: 'bottom-start',
    onOpenChange: setOpen,
    middleware,
    whileElementsMounted: autoUpdate,
    strategy: 'fixed',
  });

  const handleCalendarApply = useCallback(
    (date: DateTime) => {
      setOpen(false);
      onChange(date);
    },
    [onChange]
  );

  const onOpen = useCallback(
    (event: FormEvent<HTMLElement>) => {
      event.preventDefault();
      setOpen(true);
    },
    [setOpen]
  );

  return (
    <div data-testid="date-time-picker" style={{ position: 'relative' }}>
      <DateTimeInput
        date={date}
        onChange={onChange}
        isFullscreen={isFullscreen}
        onOpen={onOpen}
        label={label}
        ref={refs.setReference}
        showSeconds={showSeconds}
      />
      {isOpen ? (
        isFullscreen ? (
          <Portal>
            <FocusScope contain autoFocus restoreFocus>
              <div ref={ref} {...overlayProps} {...dialogProps}>
                <DateTimeCalendar
                  date={date}
                  onChange={handleCalendarApply}
                  isFullscreen={true}
                  onClose={() => setOpen(false)}
                  maxDate={maxDate}
                  minDate={minDate}
                  ref={refs.setFloating}
                  style={floatingStyles}
                  showSeconds={showSeconds}
                  disabledHours={disabledHours}
                  disabledMinutes={disabledMinutes}
                  disabledSeconds={disabledSeconds}
                />
              </div>
            </FocusScope>
          </Portal>
        ) : (
          <Portal>
            <div className={modalBackdrop} {...underlayProps} />
            <FocusScope contain autoFocus restoreFocus>
              <div ref={ref} {...overlayProps} {...dialogProps}>
                <div className={styles.modal}>
                  <DateTimeCalendar
                    date={date}
                    maxDate={maxDate}
                    minDate={minDate}
                    onChange={handleCalendarApply}
                    isFullscreen={false}
                    onClose={() => setOpen(false)}
                    showSeconds={showSeconds}
                    disabledHours={disabledHours}
                    disabledMinutes={disabledMinutes}
                    disabledSeconds={disabledSeconds}
                  />
                </div>
              </div>
            </FocusScope>
          </Portal>
        )
      ) : null}
    </div>
  );
};

interface DateTimeCalendarProps {
  date?: DateTime;
  onChange: (date: DateTime) => void;
  onClose: () => void;
  isFullscreen: boolean;
  maxDate?: Date;
  minDate?: Date;
  style?: React.CSSProperties;
  showSeconds?: boolean;
  disabledHours?: () => number[];
  disabledMinutes?: () => number[];
  disabledSeconds?: () => number[];
}

interface InputProps {
  label?: ReactNode;
  date?: DateTime;
  isFullscreen: boolean;
  onChange: (date: DateTime) => void;
  onOpen: (event: FormEvent<HTMLElement>) => void;
  showSeconds?: boolean;
}

const DateTimeInput = React.forwardRef<HTMLInputElement, InputProps>(
  ({ date, label, onChange, onOpen, showSeconds = true }, ref) => {
    const format = useDateTimeFormat(showSeconds);
    const getFormattedDate = useGetFormattedDate(showSeconds);

    const [value, setValue] = useState<string>(getFormattedDate(date ?? dateTime()));
    const [isInvalid, setIsInvalid] = useState<boolean>(!isValid(value));

    useEffect(() => {
      setValue(getFormattedDate(date));
    }, [date, getFormattedDate]);

    useEffect(() => {
      // Need to pass format to `dateTime` to ensure that the date is parsed correctly and that moment doesn't
      // fall back to using `Date` (with an accompanying warning).
      const newDate = dateTime(value, format);
      setIsInvalid(!newDate.isValid());
    }, [format, value]);

    const handleOnChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
      const { value } = event.currentTarget;
      setValue(value);
    }, []);

    const handleOnBlur = useCallback(() => {
      if (isInvalid) {
        return;
      }

      onChange(dateTimeForTimeZone(getTimeZone(), value));
    }, [isInvalid, onChange, value]);

    const calendarButton = useMemo(
      () => <Button aria-label="Time picker" icon="calendar-alt" variant="secondary" onClick={onOpen} />,
      [onOpen]
    );

    return (
      <InlineField
        label={label}
        invalid={isInvalid}
        className={css({
          marginBottom: 0,
        })}
      >
        <Input
          onChange={handleOnChange}
          addonAfter={calendarButton}
          value={value}
          onBlur={handleOnBlur}
          data-testid={Components.DateTimePicker.input}
          placeholder="Select date/time"
          ref={ref}
        />
      </InlineField>
    );
  }
);

DateTimeInput.displayName = 'DateTimeInput';

const DateTimeCalendar = React.forwardRef<HTMLDivElement, DateTimeCalendarProps>(
  (
    {
      date,
      onClose,
      onChange,
      isFullscreen,
      maxDate,
      minDate,
      style,
      showSeconds = true,
      disabledHours,
      disabledMinutes,
      disabledSeconds,
    },
    ref
  ) => {
    const calendarStyles = useStyles2(getBodyStyles);
    const styles = useStyles2(getStyles);
    const getFormattedDate = useGetFormattedDate(showSeconds);

    // To simply the handing of `DateTime` and `Date` objects, we will use store them into separate states
    // and as strings. This way, we can easily convert them to `DateTime` objects when needed (see `value`).
    const [timeValue, setTimeValue] = useState<string>(getFormattedDate(date && date.isValid() ? date : dateTime()));
    const [dateValue, setDateValue] = useState<string>(timeValue);

    useEffect(() => {
      const newValue = getFormattedDate(date);
      setTimeValue(newValue);
    }, [getFormattedDate, date]);

    useEffect(() => {
      setDateValue(timeValue);
    }, [timeValue]);

    useEffect(() => {}, []);

    // Create date time object from the date and time values
    // This is both used by `TimeOfDayPicker.value` and as param for the `onChange` callback
    const value = useMemo(() => {
      const [datePart] = dateValue.split(' ');
      const [, timePart] = timeValue.split(' ');

      // Combine the date and time parts and apply user timezone to get the correct `DateTime` object
      return dateTimeForTimeZone(getTimeZone(), `${datePart} ${timePart}`);
    }, [dateValue, timeValue]);

    const handleOnChangeDate = useCallback<NonNullable<React.ComponentProps<typeof Calendar>['onChange']>>(
      (newValue) => {
        if (Array.isArray(newValue)) {
          return;
        }

        // Calendar is using the browser timezone, so we cannot apply user timezone when formatting
        setDateValue(dateTimeFormat(newValue, { timeZone: 'browser' }));
      },
      []
    );

    const handleOnChangeTime = useCallback(
      (newValue: DateTime) => {
        setTimeValue(getFormattedDate(newValue));
      },
      [getFormattedDate]
    );

    const handleOnApply = useCallback(() => {
      onChange(value);
    }, [onChange, value]);

    return (
      <div className={cx(styles.container, { [styles.fullScreen]: isFullscreen })} style={style} ref={ref}>
        <Calendar
          next2Label={null}
          prev2Label={null}
          value={dateValue}
          nextLabel={<Icon name="angle-right" />}
          nextAriaLabel="Next month"
          prevLabel={<Icon name="angle-left" />}
          prevAriaLabel="Previous month"
          onChange={handleOnChangeDate}
          locale="en"
          className={calendarStyles.body}
          tileClassName={calendarStyles.title}
          maxDate={maxDate}
          minDate={minDate}
        />
        <div className={styles.time}>
          <TimeOfDayPicker
            showSeconds={showSeconds}
            onChange={handleOnChangeTime}
            value={value}
            disabledHours={disabledHours}
            disabledMinutes={disabledMinutes}
            disabledSeconds={disabledSeconds}
          />
        </div>
        <Stack>
          <Button type="button" onClick={handleOnApply}>
            Apply
          </Button>
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
        </Stack>
      </div>
    );
  }
);

DateTimeCalendar.displayName = 'DateTimeCalendar';

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    padding: theme.spacing(1),
    border: `1px ${theme.colors.border.weak} solid`,
    borderRadius: theme.shape.radius.default,
    backgroundColor: theme.colors.background.primary,
    zIndex: theme.zIndex.modal,
  }),
  fullScreen: css({
    position: 'absolute',
  }),
  time: css({
    marginBottom: theme.spacing(2),
  }),
  modal: css({
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    zIndex: theme.zIndex.modal,
    maxWidth: '280px',
  }),
});
