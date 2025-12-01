import { css, cx } from '@emotion/css';
import { HTMLAttributes } from 'react';
import * as React from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes/ThemeContext';
import { Spinner } from '../Spinner/Spinner';

/**
 * @public
 */
export interface LoadingPlaceholderProps extends HTMLAttributes<HTMLDivElement> {
  text: React.ReactNode;
}

/**
 * Loading indicator with a text. Used to alert a user to wait for an activity to complete.
 *
 * https://developers.grafana.com/ui/latest/index.html?path=/docs/information-loadingplaceholder--docs
 * @public
 */
export const LoadingPlaceholder = ({ text, className, ...rest }: LoadingPlaceholderProps) => {
  const styles = useStyles2(getStyles);
  return (
    <div className={cx(styles.container, className)} {...rest}>
      {text} <Spinner inline={true} />
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css({
      marginBottom: theme.spacing(4),
    }),
  };
};
