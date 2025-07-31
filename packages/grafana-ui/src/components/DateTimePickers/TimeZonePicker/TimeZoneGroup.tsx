import { css } from '@emotion/css';
import * as React from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../../themes/ThemeContext';

interface Props {
  label: string | undefined;
  children?: React.ReactNode;
}

export const TimeZoneGroup = (props: Props) => {
  const { children, label } = props;
  const styles = useStyles2(getStyles);

  if (!label) {
    return <div>{children}</div>;
  }

  return (
    <div>
      <div className={styles.header}>
        <span className={styles.label}>{label}</span>
      </div>
      {children}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    header: css({
      padding: '7px 10px',
      width: '100%',
      borderTop: `1px solid ${theme.colors.border.weak}`,
      textTransform: 'capitalize',
    }),
    label: css({
      fontSize: theme.typography.size.sm,
      color: theme.colors.text.secondary,
      fontWeight: theme.typography.fontWeightMedium,
    }),
  };
};
