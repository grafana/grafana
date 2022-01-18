import React from 'react';
import { css } from '@emotion/css';
import { useStyles2 } from '../../themes';
import { GrafanaTheme2 } from '@grafana/data';

export interface Props {
  text?: string;
}
export const ProBadge = ({ text = 'PRO' }: Props) => {
  const styles = useStyles2(getStyles);

  return <span className={styles.badge}>{text}</span>;
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    badge: css`
      margin-left: ${theme.spacing(1.25)};
      border-radius: ${theme.shape.borderRadius(5)};
      background-color: ${theme.colors.success.main};
      padding: ${theme.spacing(0.25, 0.75)};
      color: ${theme.colors.text.maxContrast};
      font-weight: ${theme.typography.fontWeightMedium};
      font-size: ${theme.typography.pxToRem(10)};
    `,
  };
};
