import { css, cx } from '@emotion/css';
import React, { HTMLAttributes, SFC } from 'react';

import { GrafanaTheme } from '@grafana/data';

import { useStyles } from '../../themes';
import { Spinner } from '../Spinner/Spinner';

/**
 * @public
 */
export interface LoadingPlaceholderProps extends HTMLAttributes<HTMLDivElement> {
  text: React.ReactNode;
}

/**
 * @public
 */
export const LoadingPlaceholder: SFC<LoadingPlaceholderProps> = ({ text, className, ...rest }) => {
  const styles = useStyles(getStyles);
  return (
    <div className={cx(styles.container, className)} {...rest}>
      {text} <Spinner inline={true} />
    </div>
  );
};

const getStyles = (theme: GrafanaTheme) => {
  return {
    container: css`
      margin-bottom: ${theme.spacing.xl};
    `,
  };
};
