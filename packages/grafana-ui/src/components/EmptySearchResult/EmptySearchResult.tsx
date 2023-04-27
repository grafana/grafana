import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes';

export interface Props {
  children: JSX.Element | string;
}

const EmptySearchResult = ({ children }: Props) => {
  const styles = useStyles2(getStyles);
  return <div className={styles.container}>{children}</div>;
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css`
      border-left: 3px solid ${theme.colors.info.main};
      background-color: ${theme.colors.background.secondary};
      padding: ${theme.spacing(2)};
      min-width: 350px;
      border-radius: ${theme.shape.radius.default};
      margin-bottom: ${theme.spacing(4)};
    `,
  };
};
export { EmptySearchResult };
