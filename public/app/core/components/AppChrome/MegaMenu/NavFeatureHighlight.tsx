import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

export interface Props {
  children: JSX.Element;
}

export const NavFeatureHighlight = ({ children }: Props): JSX.Element => {
  const styles = useStyles2(getStyles);
  return (
    <div>
      {children}
      <span className={styles.highlight} />
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    highlight: css`
      background-color: ${theme.colors.success.main};
      border-radius: ${theme.shape.radius.circle};
      width: 6px;
      height: 6px;
      display: inline-block;
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
    `,
  };
};
