import { css, cx } from '@emotion/css';
import React, { HTMLAttributes, SFC } from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes';
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
  const styles = useStyles2(getStyles);
  return (
    <div className={cx(styles.container, className)} {...rest}>
      {text} <Spinner inline={true} />
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css`
      margin-bottom: ${theme.spacing(4)};
    `,
  };
};
