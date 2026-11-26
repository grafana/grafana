import { css } from '@emotion/css';
import { FocusScope } from '@react-aria/focus';

import { type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';

import { useStyles2 } from '../../../themes/ThemeContext';
import { Button } from '../../Button/Button';
import { Stack } from '../../Layout/Stack/Stack';

import { Body } from './CalendarBody';
import { type TimePickerCalendarProps } from './TimePickerCalendar';

interface Props extends Omit<TimePickerCalendarProps, 'isOpen' | 'onApply'> {
  onUpdateInputs: () => void;
}

export function InlineTimePickerCalendar(props: Props) {
  const styles = useStyles2(getStyles);
  return (
    <FocusScope autoFocus>
      <section
        role="dialog"
        tabIndex={-1}
        aria-label={t('time-picker.inline-calendar.label', 'Calendar')}
        className={styles.calendar}
        onKeyDownCapture={(event) => {
          if (event.key === 'Escape') {
            event.stopPropagation();
            props.onClose();
          }
        }}
      >
        <Body {...props} />
        <Stack gap={2} justifyContent="space-between">
          <Button variant="secondary" onClick={props.onClose}>
            <Trans i18nKey="time-picker.calendar.cancel-button">Cancel</Trans>
          </Button>
          <Button onClick={props.onUpdateInputs}>
            <Trans i18nKey="time-picker.inline-calendar.update-inputs">Update inputs</Trans>
          </Button>
        </Stack>
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
