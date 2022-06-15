import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../../themes';
import { Button } from '../../Button';

import { TimePickerCalendarProps } from './TimePickerCalendar';

export function Footer({ onClose, onApply }: TimePickerCalendarProps) {
  const styles = useStyles2(getFooterStyles);

  return (
    <div className={styles.container}>
      <Button className={styles.apply} onClick={onApply}>
        Apply time range
      </Button>
      <Button variant="secondary" onClick={onClose}>
        Cancel
      </Button>
    </div>
  );
}

Footer.displayName = 'Footer';

const getFooterStyles = (theme: GrafanaTheme2) => {
  return {
    container: css`
      background-color: ${theme.colors.background.primary};
      display: flex;
      justify-content: center;
      padding: 10px;
      align-items: stretch;
    `,
    apply: css`
      margin-right: 4px;
      width: 100%;
      justify-content: center;
    `,
  };
};
