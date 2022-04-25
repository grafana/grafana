import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

export const Page: React.FC = ({ children }) => {
  const styles = useStyles2(getStyles);
  return (
    <div className="page-container">
      <div className={styles}>{children}</div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) =>
  css`
    margin-bottom: ${theme.spacing(3)};
  `;
