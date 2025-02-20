import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes';

interface VizCustomizableTooltipHeaderProps {
  value: string | number | React.ReactNode;
}

export const VizCustomizableTooltipHeader = ({ value }: VizCustomizableTooltipHeaderProps) => {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.wrapper}>
      <span className={styles.header}>Tooltip header</span>
      <span className={styles.value}>{value}</span>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    display: 'flex',
    flexDirection: 'column',
    padding: theme.spacing(1),
    gap: theme.spacing(1),
    marginRight: theme.spacing(12),
  }),
  header: css({
    fontSize: '16px',
    fontWeight: 400,
    flexGrow: 1,
    color: 'rgba(204, 204, 220, 0.65)',
    marginRight: theme.spacing(1),
  }),
  value: css({
    fontWeight: 500,
    textOverflow: 'ellipsis',
    overflow: 'hidden',
    flexGrow: 1,
  }),
});
