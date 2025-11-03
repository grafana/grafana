import { css, cx } from '@emotion/css';
import { HTMLProps, ReactNode } from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes/ThemeContext';

export interface Props extends Omit<HTMLProps<HTMLDivElement>, 'css'> {
  children: ReactNode | ReactNode[];
}

/**
 * Used to align multiple InlineField components in one row. The row will wrap if the width of the children exceeds its own. Equivalent to the div with gf-form-inline class name. Multiple InlineFieldRows vertically stack on each other.
 *
 * https://developers.grafana.com/ui/latest/index.html?path=/docs/forms-inlinefieldrow--docs
 */
export const InlineFieldRow = ({ children, className, ...htmlProps }: Props) => {
  const styles = useStyles2(getStyles);
  return (
    <div className={cx(styles.container, className)} {...htmlProps}>
      {children}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css({
      label: 'InlineFieldRow',
      display: 'flex',
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignContent: 'flex-start',
      rowGap: theme.spacing(0.5),
    }),
  };
};
