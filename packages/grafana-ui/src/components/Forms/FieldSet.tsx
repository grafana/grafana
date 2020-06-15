import React, { FC, HTMLProps } from 'react';
import { css, cx } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { stylesFactory, useTheme } from '../../themes';
import { Legend } from './Legend';

export interface Props extends HTMLProps<HTMLFieldSetElement> {
  children: React.ReactNode[] | React.ReactNode;
  /** Text for the fieldset's legend */
  label?: string;
}

export const FieldSet: FC<Props> = ({ label, children, className, ...rest }) => {
  const theme = useTheme();
  const styles = getStyles(theme);

  return (
    <fieldset className={cx(styles.wrapper, className)} {...rest}>
      {label && <Legend>{label}</Legend>}
      {children}
    </fieldset>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    wrapper: css`
      margin-bottom: ${theme.spacing.formSpacingBase * 4}px;
    `,
  };
});
