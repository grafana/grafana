import React from 'react';
import { selectors } from '@grafana/e2e-selectors';
import { Icon } from '../Icon/Icon';
import { Tooltip } from '../Tooltip/Tooltip';

type LoadingIndicatorProps = {
  loading: boolean;
  onCancel: () => void;
};

/**
 * @internal
 */
export const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({ onCancel, loading }) => {
  if (!loading) {
    return null;
  }

  return (
    <Tooltip content="Cancel query">
      <Icon
        className="spin-clockwise"
        name="sync"
        size="sm"
        onClick={onCancel}
        aria-label={selectors.components.LoadingIndicator.icon}
      />
    </Tooltip>
  );
};
