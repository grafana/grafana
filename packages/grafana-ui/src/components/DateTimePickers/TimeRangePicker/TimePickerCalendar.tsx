import { css } from '@emotion/css';
import { autoUpdate, useFloating, useMergeRefs } from '@floating-ui/react';
import { useDialog } from '@react-aria/dialog';
import { FocusScope } from '@react-aria/focus';
import { OverlayContainer, useOverlay } from '@react-aria/overlays';
import { type FormEvent, memo, useRef } from 'react';

import { type DateTime, type GrafanaTheme2, type TimeZone } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { useStyles2 } from '../../../themes/ThemeContext';
import { getPositioningMiddleware } from '../../../utils/floating';
import { getModalStyles } from '../../Modal/getModalStyles';
import { type WeekStart } from '../WeekStartPicker';

import { Body } from './CalendarBody';
import { Footer } from './CalendarFooter';
import { Header } from './CalendarHeader';

export const getCalendarStyles = (theme: GrafanaTheme2) =>
  css({
    zIndex: theme.zIndex.modal,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    padding: theme.spacing(1),
    label: 'calendar',
    boxShadow: theme.flags.visualDesignRefresh ? theme.shadows.z2 : theme.shadows.z3,
    backgroundColor: theme.colors.background.elevated,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.lg,
  });

const getStyles = (theme: GrafanaTheme2) => {
  return {
    modalContainer: css({
      label: 'modalContainer',
      margin: '0 auto',
    }),

    calendar: getCalendarStyles(theme),

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
  referenceElement?: HTMLElement | null;
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
  const { modalBackdrop } = useStyles2(getModalStyles);
  const styles = useStyles2(getStyles);
  const { isOpen, isFullscreen: isFullscreenProp, onClose, referenceElement, isReversed } = props;
  const ref = useRef<HTMLElement>(null);
  const placement = isReversed ? 'right-start' : 'left-start';
  const { refs, floatingStyles } = useFloating({
    open: isOpen && isFullscreenProp,
    elements: { reference: referenceElement },
    placement,
    strategy: 'fixed',
    middleware: getPositioningMiddleware(placement),
    whileElementsMounted: autoUpdate,
  });
  const floatingRef = useMergeRefs([ref, refs.setFloating]);
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
      ref={showInModal ? ref : floatingRef}
      style={showInModal ? undefined : floatingStyles}
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
        {calendar}
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
