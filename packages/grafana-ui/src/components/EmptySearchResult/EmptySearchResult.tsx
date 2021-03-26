import React, { FC } from 'react';
import { GrafanaTheme } from '@grafana/data';
import { css } from 'emotion';
import { useStyles } from '../../themes';

export interface Props {
  children: JSX.Element | string;
}

const EmptySearchResult: FC<Props> = ({ children }) => {
  const styles = useStyles(getStyles);
  return <div className={styles.container}>{children}</div>;
};

const getStyles = (theme: GrafanaTheme) => {
  return {
    container: css`
      border-left: 3px solid ${theme.palette.blue80};
      background-color: ${theme.colors.bg2};
      padding: ${theme.spacing.d};
      min-width: 350px;
      border-radius: ${theme.border.radius.md};
      margin-bottom: ${theme.spacing.xl};
    `,
  };
};
export { EmptySearchResult };
