import React from 'react';
import { css } from '@emotion/css';

import { useStyles2 } from '@grafana/ui';
import { GrafanaTheme2 } from '@grafana/data';

interface HorizontalGroupProps {
  children: React.ReactNode;
}

export const HorizontalGroup = ({ children }: HorizontalGroupProps) => {
  const styles = useStyles2(getStyles);

  return <div className={styles.container}>{children}</div>;
};

const getStyles = (theme: GrafanaTheme2) => ({
  container: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    & > * {
      margin-right: ${theme.spacing()};
    }
    & > *:first-child {
      flex-grow: 1;
    }
    & > *:last-child {
      margin-right: 0;
    }
  `,
});
