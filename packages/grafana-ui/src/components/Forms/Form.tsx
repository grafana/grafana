/**
 * This is a stub implementation only for correct styles to be applied
 */

import React from 'react';
import { stylesFactory, useTheme } from '../../themes';
import { GrafanaTheme } from '@grafana/data';
import { css } from 'emotion';

const getFormStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    form: css`
      margin-bottom: ${theme.spacing.formMargin};
    `,
  };
});

export const Form: React.FC = ({ children }) => {
  const theme = useTheme();
  const styles = getFormStyles(theme);
  return <div className={styles.form}>{children}</div>;
};
