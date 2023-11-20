import React from 'react';

import { Trans } from '../../../utils/i18n';
import { Button } from '../../Button';
import { Stack } from '../../Layout/Stack/Stack';

import { TimePickerCalendarProps } from './TimePickerCalendar';

export function Footer({ onClose, onApply }: TimePickerCalendarProps) {
  return (
    <Stack justifyContent="space-between">
      <Button onClick={onApply}>
        <Trans i18nKey="time-picker.calendar.apply-button">Apply time range</Trans>
      </Button>

      <Button variant="secondary" onClick={onClose}>
        <Trans i18nKey="time-picker.calendar.cancel-button">Cancel</Trans>
      </Button>
    </Stack>
  );
}

Footer.displayName = 'Footer';
