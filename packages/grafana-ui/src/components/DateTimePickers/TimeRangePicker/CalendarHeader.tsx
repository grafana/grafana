import { selectors } from '@grafana/e2e-selectors';
import { t, Trans } from '@grafana/i18n';

import { IconButton } from '../../IconButton/IconButton';
import { Stack } from '../../Layout/Stack/Stack';

import { TimePickerCalendarProps } from './TimePickerCalendar';
import { TimePickerTitle } from './TimePickerTitle';

export function Header({ onClose }: TimePickerCalendarProps) {
  return (
    <Stack justifyContent="space-between">
      <TimePickerTitle>
        <Trans i18nKey="time-picker.calendar.select-time">Select a time range</Trans>
      </TimePickerTitle>

      <IconButton
        data-testid={selectors.components.TimePicker.calendar.closeButton}
        tooltip={t(`time-picker.calendar.close`, 'Close calendar')}
        name="times"
        variant="secondary"
        onClick={onClose}
      />
    </Stack>
  );
}

Header.displayName = 'Header';
