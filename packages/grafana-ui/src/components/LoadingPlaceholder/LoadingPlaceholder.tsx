import React, { HTMLAttributes, SFC } from 'react';
import { css, cx } from '@emotion/css';
import { GrafanaTheme } from '@grafana/data';
import { Spinner } from '../Spinner/Spinner';
import { useStyles } from '../../themes';

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
