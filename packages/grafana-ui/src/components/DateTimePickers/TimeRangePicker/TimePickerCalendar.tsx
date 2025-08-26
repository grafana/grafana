import { css } from '@emotion/css';
import { useDialog } from '@react-aria/dialog';
import { FocusScope } from '@react-aria/focus';
import { OverlayContainer, useOverlay } from '@react-aria/overlays';
import { createRef, FormEvent, memo } from 'react';

import { DateTime, GrafanaTheme2, TimeZone } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { useStyles2, useTheme2 } from '../../../themes/ThemeContext';
import { getModalStyles } from '../../Modal/getModalStyles';
import { WeekStart } from '../WeekStartPicker';

import { Body } from './CalendarBody';
import { Footer } from './CalendarFooter';
import { Header } from './CalendarHeader';

export const getStyles = (theme: GrafanaTheme2, isReversed = false) => {
  return {
    container: css({
      top: 0,
      position: 'absolute',
      [`${isReversed ? 'left' : 'right'}`]: '546px', // lmao
    }),

    modalContainer: css({
      label: 'modalContainer',
      margin: '0 auto',
    }),

    calendar: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
      padding: theme.spacing(1),
      label: 'calendar',
      boxShadow: theme.shadows.z3,
      backgroundColor: theme.colors.background.elevated,
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
    }),

    modal: css({
      label: 'modal',
      boxShadow: theme.shadows.z3,
      left: '50%',
      position: 'fixed',
      top: '50%',
      transform: 'translate(-50%, -50%)',
      zIndex: theme.zIndex.modal,
    }),
  };
};

export interface TimePickerCalendarProps {
  isOpen: boolean;
  from: DateTime;
  to: DateTime;
  onClose: () => void;
  onApply: (e: FormEvent<HTMLButtonElement>) => void;
  onChange: (from: DateTime, to: DateTime) => void;
  weekStart?: WeekStart;

  /**
   * When true, the calendar is rendered as a floating "tooltip" next to the input.
   * When false, the calendar is rendered "fullscreen" in a modal. Yes. Don't ask.
   */
  isFullscreen: boolean;
  timeZone?: TimeZone;
  isReversed?: boolean;
}

function TimePickerCalendar(props: TimePickerCalendarProps) {
  const theme = useTheme2();
  const { modalBackdrop } = useStyles2(getModalStyles);
  const styles = getStyles(theme, props.isReversed);
  const { isOpen, isFullscreen: isFullscreenProp, onClose } = props;
  const ref = createRef<HTMLElement>();
  const { dialogProps } = useDialog(
    {
      'aria-label': selectors.components.TimePicker.calendar.label,
    },
    ref
  );
  const { overlayProps } = useOverlay(
    {
      isDismissable: true,
      isOpen,
      onClose,
    },
    ref
  );

  // This prop is confusingly worded, so rename it to something more intuitive.
  const showInModal = !isFullscreenProp;

  if (!isOpen) {
    return null;
  }

  const calendar = (
    <section
      className={styles.calendar}
      ref={ref}
      {...overlayProps}
      {...dialogProps}
      data-testid={selectors.components.TimePicker.calendar.label}
    >
      <Header {...props} />
      <Body {...props} />
      {showInModal && <Footer {...props} />}
    </section>
  );

  if (!showInModal) {
    return (
      <FocusScope contain restoreFocus autoFocus>
        <div className={styles.container}>{calendar}</div>
      </FocusScope>
    );
  }

  return (
    <OverlayContainer>
      <div className={modalBackdrop} />

      <FocusScope contain autoFocus restoreFocus>
        <div className={styles.modal}>
          <div className={styles.modalContainer}>{calendar}</div>
        </div>
      </FocusScope>
    </OverlayContainer>
  );
}
export default memo(TimePickerCalendar);
TimePickerCalendar.displayName = 'TimePickerCalendar';
