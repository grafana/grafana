import { css, cx } from '@emotion/css';
import React, { HTMLProps } from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { stylesFactory, useTheme2 } from '../../themes';

import { Legend } from './Legend';

export interface Props extends Omit<HTMLProps<HTMLFieldSetElement>, 'label'> {
  children: React.ReactNode[] | React.ReactNode;
  /** Label for the fieldset's legend */
  label?: React.ReactNode;
}

export const FieldSet = ({ label, children, className, ...rest }: Props) => {
  const theme = useTheme2();
  const styles = getStyles(theme);

  return (
    <fieldset className={cx(styles.wrapper, className)} {...rest}>
      {label && <Legend>{label}</Legend>}
      {children}
    </fieldset>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme2) => {
  return {
    wrapper: css`
      margin-bottom: ${theme.spacing(4)};

      &:last-child {
        margin-bottom: 0;
      }
    `,
  };
});
