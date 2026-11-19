import { css } from '@emotion/css';
import { FocusScope } from '@react-aria/focus';
import { useOverlay } from '@react-aria/overlays';
import { useRef } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';

import { useStyles2 } from '../../../themes/ThemeContext';

import { Body } from './CalendarBody';
import { Footer } from './CalendarFooter';
import { type TimePickerCalendarProps } from './TimePickerCalendar';

export function InlineTimePickerCalendar(props: Omit<TimePickerCalendarProps, 'isOpen'>) {
  const styles = useStyles2(getStyles);
  const ref = useRef<HTMLElement>(null);
  const { overlayProps } = useOverlay({ isOpen: true, onClose: props.onClose }, ref);
  return (
    <FocusScope autoFocus>
      <section
        role="dialog"
        tabIndex={-1}
        aria-label={t('time-picker.inline-calendar.label', 'Calendar')}
        className={styles.calendar}
        ref={ref}
        {...overlayProps}
      >
        <Body {...props} />
        <Footer {...props} isOpen />
      </section>
    </FocusScope>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  calendar: css({
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.lg,
    padding: theme.spacing(1),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
  }),
});
