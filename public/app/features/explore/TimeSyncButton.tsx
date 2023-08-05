import React from 'react';

import { Tooltip, ToolbarButton } from '@grafana/ui';

interface TimeSyncButtonProps {
  isSynced: boolean;
  onClick: () => void;
}

export function TimeSyncButton(props: TimeSyncButtonProps) {
  const { onClick, isSynced } = props;

  const syncTimesTooltip = () => {
    const { isSynced } = props;
    const tooltip = isSynced ? 'Unsync all views' : 'Sync all views to this time range';
    return <>{tooltip}</>;
  };

  return (
    <Tooltip content={syncTimesTooltip} placement="bottom">
      <ToolbarButton
        icon="link"
        variant={isSynced ? 'active' : 'canvas'}
        aria-label={isSynced ? 'Synced times' : 'Unsynced times'}
        onClick={onClick}
      />
    </Tooltip>
  );
}
