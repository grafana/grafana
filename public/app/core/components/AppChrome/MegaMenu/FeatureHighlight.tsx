import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

export interface Props {
  children: JSX.Element;
}

export const FeatureHighlight = ({ children }: Props): JSX.Element => {
  const styles = useStyles2(getStyles);
  return (
    <>
      {children}
      <span className={styles.highlight} />
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    highlight: css({
      backgroundColor: theme.colors.success.main,
      borderRadius: theme.shape.radius.circle,
      width: '6px',
      height: '6px',
      display: 'inline-block;',
      position: 'absolute',
      top: '50%',
      transform: 'translateY(-50%)',
    }),
  };
};
