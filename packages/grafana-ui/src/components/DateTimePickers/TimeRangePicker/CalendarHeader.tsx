import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { useStyles2 } from '../../../themes';
import { Trans } from '../../../utils/i18n';
import { Button } from '../../Button';

import { TimePickerCalendarProps } from './TimePickerCalendar';
import { TimePickerTitle } from './TimePickerTitle';

export function Header({ onClose }: TimePickerCalendarProps) {
  const styles = useStyles2(getHeaderStyles);

  return (
    <div className={styles.container}>
      <TimePickerTitle>
        <Trans i18nKey="time-picker.calendar.select-time">Select a time range</Trans>
      </TimePickerTitle>
      <Button
        aria-label={selectors.components.TimePicker.calendar.closeButton}
        icon="times"
        variant="secondary"
        onClick={onClose}
      />
    </div>
  );
}

Header.displayName = 'Header';

const getHeaderStyles = (theme: GrafanaTheme2) => {
  return {
    container: css`
      background-color: ${theme.colors.background.primary};
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 7px;
    `,
  };
};
