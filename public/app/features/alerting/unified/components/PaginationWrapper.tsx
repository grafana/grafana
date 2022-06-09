import { css } from '@emotion/css';
import React, { FC } from 'react';

import { GrafanaTheme2 } from '@grafana/data/src';
import { useStyles2 } from '@grafana/ui/src';

export const PaginationWrapper: FC = ({ children }) => {
  const styles = useStyles2(getStyles);

  return <div className={styles.wrapper}>{children}</div>;
};

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css`
    display: flex;
    justify-content: flex-start;
    margin: ${theme.spacing(2, 0)};
  `,
});
