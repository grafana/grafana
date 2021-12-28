import React from 'react';
import { TimePickerTitle } from './TimePickerTitle';
import { Button } from '../../Button';
import { selectors } from '@grafana/e2e-selectors';
import { TimePickerCalendarProps } from './TimePickerCalendar';
import { useStyles2 } from '../../../themes';
import { GrafanaTheme2 } from '@grafana/data';
import { css } from '@emotion/css';

export function Header({ onClose }: TimePickerCalendarProps) {
  const styles = useStyles2(getHeaderStyles);

  return (
    <div className={styles.container}>
      <TimePickerTitle>Select a time range</TimePickerTitle>
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
