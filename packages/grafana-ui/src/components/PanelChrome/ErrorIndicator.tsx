import { css, cx } from '@emotion/css';
import React from 'react';

import { useStyles2 } from '../../themes';
import { commonColorsPalette } from '../../themes/default';
import { Icon } from '../Icon/Icon';
import { Tooltip } from '../Tooltip/Tooltip';

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
  const styles = useStyles2(getStyles);

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

const getStyles = () => {
  return {
    clickable: css`
      cursor: pointer;
    `,
    icon: css`
      color: ${commonColorsPalette.red88};
    `,
  };
};
