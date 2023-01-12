import { css, cx } from '@emotion/css';
import { useDialog } from '@react-aria/dialog';
import { FocusScope } from '@react-aria/focus';
import { useOverlay } from '@react-aria/overlays';
import React, { FormEvent, ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import Calendar from 'react-calendar';
import { usePopper } from 'react-popper';
import { useMedia } from 'react-use';

import { dateTimeFormat, DateTime, dateTime, GrafanaTheme2, isDateTime } from '@grafana/data';

import { Button, HorizontalGroup, Icon, InlineField, Input, Portal } from '../..';
import { useStyles2, useTheme2 } from '../../../themes';
import { getModalStyles } from '../../Modal/getModalStyles';
import { TimeOfDayPicker } from '../TimeOfDayPicker';
import { getBodyStyles } from '../TimeRangePicker/CalendarBody';
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
}

export const DateTimePicker = ({ date, maxDate, label, onChange }: Props) => {
  const [isOpen, setOpen] = useState(false);

  const ref = useRef<HTMLDivElement>(null);
  const { overlayProps, underlayProps } = useOverlay(
    { onClose: () => setOpen(false), isDismissable: true, isOpen },
    ref
  );
  const { dialogProps } = useDialog({}, ref);

  const theme = useTheme2();
  const { modalBackdrop } = getModalStyles(theme);
  const isFullscreen = useMedia(`(min-width: ${theme.breakpoints.values.lg}px)`);
  const styles = useStyles2(getStyles);

  const [markerElement, setMarkerElement] = useState<HTMLInputElement | null>();
  const [selectorElement, setSelectorElement] = useState<HTMLDivElement | null>();

  const popper = usePopper(markerElement, selectorElement, {
    placement: 'bottom-start',
  });

  const onApply = useCallback(
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
        ref={setMarkerElement}
      />
      {isOpen ? (
        isFullscreen ? (
          <Portal>
            <FocusScope contain autoFocus restoreFocus>
              <div ref={ref} {...overlayProps} {...dialogProps}>
                <DateTimeCalendar
                  date={date}
                  onChange={onApply}
                  isFullscreen={true}
                  onClose={() => setOpen(false)}
                  maxDate={maxDate}
                  ref={setSelectorElement}
                  style={popper.styles.popper}
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
                    onChange={onApply}
                    isFullscreen={false}
                    onClose={() => setOpen(false)}
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
  style?: React.CSSProperties;
}

interface InputProps {
  label?: ReactNode;
  date?: DateTime;
  isFullscreen: boolean;
  onChange: (date: DateTime) => void;
  onOpen: (event: FormEvent<HTMLElement>) => void;
}

type InputState = {
  value: string;
  invalid: boolean;
};

const DateTimeInput = React.forwardRef<HTMLInputElement, InputProps>(
  ({ date, label, onChange, isFullscreen, onOpen }, ref) => {
    const [internalDate, setInternalDate] = useState<InputState>(() => {
      return { value: date ? dateTimeFormat(date) : dateTimeFormat(dateTime()), invalid: false };
    });

    useEffect(() => {
      if (date) {
        setInternalDate({
          invalid: !isValid(dateTimeFormat(date)),
          value: isDateTime(date) ? dateTimeFormat(date) : date,
        });
      }
    }, [date]);

    const onChangeDate = useCallback((event: FormEvent<HTMLInputElement>) => {
      const isInvalid = !isValid(event.currentTarget.value);
      setInternalDate({
        value: event.currentTarget.value,
        invalid: isInvalid,
      });
    }, []);

    const onBlur = useCallback(() => {
      if (isDateTime(internalDate.value)) {
        onChange(dateTime(internalDate.value));
      }
    }, [internalDate.value, onChange]);

    const icon = <Button aria-label="Time picker" icon="calendar-alt" variant="secondary" onClick={onOpen} />;
    return (
      <InlineField
        label={label}
        invalid={!!(internalDate.value && internalDate.invalid)}
        className={css`
          margin-bottom: 0;
        `}
      >
        <Input
          onChange={onChangeDate}
          addonAfter={icon}
          value={internalDate.value}
          onBlur={onBlur}
          data-testid="date-time-input"
          placeholder="Select date/time"
          ref={ref}
        />
      </InlineField>
    );
  }
);

DateTimeInput.displayName = 'DateTimeInput';

const DateTimeCalendar = React.forwardRef<HTMLDivElement, DateTimeCalendarProps>(
  ({ date, onClose, onChange, isFullscreen, maxDate, style }, ref) => {
    const calendarStyles = useStyles2(getBodyStyles);
    const styles = useStyles2(getStyles);
    const [internalDate, setInternalDate] = useState<Date>(() => {
      if (date && date.isValid()) {
        return date.toDate();
      }

      return new Date();
    });

    const onChangeDate = useCallback((date: Date | Date[]) => {
      if (!Array.isArray(date)) {
        setInternalDate((prevState) => {
          // If we don't use time from prevState
          // the time will be reset to 00:00:00
          date.setHours(prevState.getHours());
          date.setMinutes(prevState.getMinutes());
          date.setSeconds(prevState.getSeconds());

          return date;
        });
      }
    }, []);

    const onChangeTime = useCallback((date: DateTime) => {
      setInternalDate(date.toDate());
    }, []);

    return (
      <div className={cx(styles.container, { [styles.fullScreen]: isFullscreen })} style={style} ref={ref}>
        <Calendar
          next2Label={null}
          prev2Label={null}
          value={internalDate}
          nextLabel={<Icon name="angle-right" />}
          nextAriaLabel="Next month"
          prevLabel={<Icon name="angle-left" />}
          prevAriaLabel="Previous month"
          onChange={onChangeDate}
          locale="en"
          className={calendarStyles.body}
          tileClassName={calendarStyles.title}
          maxDate={maxDate}
        />
        <div className={styles.time}>
          <TimeOfDayPicker showSeconds={true} onChange={onChangeTime} value={dateTime(internalDate)} />
        </div>
        <HorizontalGroup>
          <Button type="button" onClick={() => onChange(dateTime(internalDate))}>
            Apply
          </Button>
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
        </HorizontalGroup>
      </div>
    );
  }
);

DateTimeCalendar.displayName = 'DateTimeCalendar';

const getStyles = (theme: GrafanaTheme2) => ({
  container: css`
    padding: ${theme.spacing(1)};
    border: 1px ${theme.colors.border.weak} solid;
    border-radius: ${theme.shape.borderRadius(1)};
    background-color: ${theme.colors.background.primary};
    z-index: ${theme.zIndex.modal};
  `,
  fullScreen: css`
    position: absolute;
  `,
  time: css`
    margin-bottom: ${theme.spacing(2)};
  `,
  modal: css`
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: ${theme.zIndex.modal};
    max-width: 280px;
  `,
});
