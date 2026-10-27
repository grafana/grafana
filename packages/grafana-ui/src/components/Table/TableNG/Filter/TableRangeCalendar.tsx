import { autoUpdate, flip, shift, useFloating } from '@floating-ui/react';
import { useDialog } from '@react-aria/dialog';
import { FocusScope } from '@react-aria/focus';
import { useOverlay } from '@react-aria/overlays';
import { useRef } from 'react';

import { selectors } from '@grafana/e2e-selectors';

import { useStyles2 } from '../../../../themes/ThemeContext';
import { Body } from '../../../DateTimePickers/TimeRangePicker/CalendarBody';
import { Header } from '../../../DateTimePickers/TimeRangePicker/CalendarHeader';
import {
  getCalendarStyles,
  type TimePickerCalendarProps,
} from '../../../DateTimePickers/TimeRangePicker/TimePickerCalendar';

interface Props extends Omit<TimePickerCalendarProps, 'isFullscreen' | 'onApply'> {
  anchorElement: HTMLElement | null;
  minDate?: Date;
  maxDate?: Date;
}

export function TableRangeCalendar(props: Props) {
  const calendarStyle = useStyles2(getCalendarStyles);
  const ref = useRef<HTMLElement>(null);
  const { refs, floatingStyles } = useFloating({
    elements: { reference: props.anchorElement },
    placement: 'left-start',
    strategy: 'fixed',
    middleware: [flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });
  const { dialogProps } = useDialog({ 'aria-label': selectors.components.TimePicker.calendar.label }, ref);
  const { overlayProps } = useOverlay({ isDismissable: true, isOpen: props.isOpen, onClose: props.onClose }, ref);

  if (!props.isOpen) {
    return null;
  }

  return (
    <FocusScope contain restoreFocus autoFocus>
      <div ref={refs.setFloating} style={floatingStyles}>
        <section
          className={calendarStyle}
          ref={ref}
          {...overlayProps}
          {...dialogProps}
          data-testid={selectors.components.TimePicker.calendar.label}
        >
          <Header {...props} />
          <Body {...props} />
        </section>
      </div>
    </FocusScope>
  );
}
