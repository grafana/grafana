import React from 'react';
import { css, cx } from '@emotion/css';
import { Icon } from '../Icon/Icon';
import { Tooltip } from '../Tooltip/Tooltip';
import { useStyles } from '../../themes';
import { GrafanaTheme } from '@grafana/data';

/**
 * @internal
 */
export type ErrorIndicatorProps = {
  error?: string;
  onClick?: () => void;
};

/**
 * @internal
 */
export const ErrorIndicator: React.FC<ErrorIndicatorProps> = ({ error, onClick }) => {
  const styles = useStyles(getStyles);

  if (!error) {
    return null;
  }

  return (
    <Tooltip theme="error" content={error}>
      <Icon
        onClick={onClick}
        className={cx(styles.icon, { [styles.clickable]: !!onClick })}
        size="sm"
        name="exclamation-triangle"
      />
    </Tooltip>
  );
};

const getStyles = (theme: GrafanaTheme) => {
  return {
    clickable: css`
      cursor: pointer;
    `,
    icon: css`
      color: ${theme.palette.red88};
    `,
  };
};
