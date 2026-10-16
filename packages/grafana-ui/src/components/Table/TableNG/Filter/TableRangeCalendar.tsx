import { css } from '@emotion/css';
import { autoUpdate, flip, shift, useFloating } from '@floating-ui/react';
import { useDialog } from '@react-aria/dialog';
import { FocusScope } from '@react-aria/focus';
import { useOverlay } from '@react-aria/overlays';
import { useRef } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { useStyles2 } from '../../../../themes/ThemeContext';
import { Body } from '../../../DateTimePickers/TimeRangePicker/CalendarBody';
import { Header } from '../../../DateTimePickers/TimeRangePicker/CalendarHeader';
import { type TimePickerCalendarProps } from '../../../DateTimePickers/TimeRangePicker/TimePickerCalendar';

interface Props extends TimePickerCalendarProps {
  anchorElement: HTMLElement | null;
}

export function TableRangeCalendar(props: Props) {
  const styles = useStyles2(getStyles);
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
          className={styles.calendar}
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

const getStyles = (theme: GrafanaTheme2) => ({
  calendar: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    padding: theme.spacing(1),
    boxShadow: theme.flags.visualDesignRefresh ? theme.shadows.z2 : theme.shadows.z3,
    backgroundColor: theme.colors.background.elevated,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.lg,
  }),
});
