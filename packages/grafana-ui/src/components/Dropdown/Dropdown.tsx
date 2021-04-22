import React from 'react';
import { css } from '@emotion/css';
import { useStyles2 } from '../../themes';
import { GrafanaThemeV2 } from '@grafana/data';

export interface Props {
  children: React.ReactNode;
}

/**
 * @internal
 */
export const Dropdown = React.memo(<T,>({ children }: Props) => {
  const styles = useStyles2(getStyles);

  return <div className={styles.wrapper}>{children}</div>;
});

Dropdown.displayName = 'Dropdown';

const getStyles = (theme: GrafanaThemeV2) => {
  return {
    wrapper: css`
      position: absolute;
      z-index: ${theme.zIndex.dropdown};
      right: 0;
    `,
  };
};
