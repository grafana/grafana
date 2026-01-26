import { css, cx } from '@emotion/css';
import { HTMLProps } from 'react';
import * as React from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes/ThemeContext';

import { Legend } from './Legend';

export interface Props extends Omit<HTMLProps<HTMLFieldSetElement>, 'label'> {
  children: React.ReactNode[] | React.ReactNode;
  /** Label for the fieldset's legend */
  label?: React.ReactNode;
}

/**
 * Component used to group form elements inside a form, equivalent to HTML's [fieldset](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/fieldset) tag. Accepts optional label, which, if provided, is used as a text for the set's legend.
 *
 * https://developers.grafana.com/ui/latest/index.html?path=/docs/forms-fieldset--docs
 */
export const FieldSet = ({ label, children, className, ...rest }: Props) => {
  const styles = useStyles2(getStyles);

  return (
    <fieldset className={cx(styles.wrapper, className)} {...rest}>
      {label && <Legend>{label}</Legend>}
      {children}
    </fieldset>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    marginBottom: theme.spacing(4),

    '&:last-child': {
      marginBottom: 0,
    },
  }),
});
