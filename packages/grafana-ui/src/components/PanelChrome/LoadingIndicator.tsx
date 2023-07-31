import { css, cx } from '@emotion/css';
import React from 'react';

import { selectors } from '@grafana/e2e-selectors';

import { useStyles2 } from '../../themes';
import { Icon } from '../Icon/Icon';
import { Tooltip } from '../Tooltip/Tooltip';

/**
 * @internal
 */
export type LoadingIndicatorProps = {
  loading: boolean;
  onCancel: () => void;
};

/**
 * @internal
 */
export const LoadingIndicator = ({ onCancel, loading }: LoadingIndicatorProps) => {
  const styles = useStyles2(getStyles);

  if (!loading) {
    return null;
  }

  return (
    <Tooltip content="Cancel query">
      <Icon
        className={cx('spin-clockwise', { [styles.clickable]: !!onCancel })}
        name="sync"
        size="sm"
        onClick={onCancel}
        aria-label={selectors.components.LoadingIndicator.icon}
      />
    </Tooltip>
  );
};

const getStyles = () => {
  return {
    clickable: css({
      cursor: 'pointer',
    }),
  };
};
