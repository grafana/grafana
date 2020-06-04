import React, { FC, HTMLProps } from 'react';
import { stylesFactory, useTheme } from '../../themes';
import { GrafanaTheme } from '@grafana/data';
import { css, cx } from 'emotion';
import { Legend } from './Legend';

export interface Props extends HTMLProps<HTMLFieldSetElement> {
  children: React.ReactNode[] | React.ReactNode;
  /** Text for the fieldset's Legend **/
  label?: string;
}

export const FieldSet: FC<Props> = ({ label, children, className, ...props }) => {
  const theme = useTheme();
  const styles = getStyles(theme);
  return (
    <fieldset className={cx(styles.wrapper, className)} {...props}>
      <>
        {label && <Legend>{label}</Legend>}
        {children}
      </>
    </fieldset>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    wrapper: css`
      margin-bottom: ${theme.spacing.xl};
    `,
  };
});
