import React from 'react';
import classNames from 'classnames';
import { Tooltip, Icon } from '@grafana/ui';

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
      <button
        className={classNames('btn navbar-button navbar-button--attached', {
          [`explore-active-button`]: isSynced,
        })}
        aria-label={isSynced ? 'Synced times' : 'Unsynced times'}
        onClick={() => onClick()}
      >
        <Icon name="link" className={isSynced ? 'icon-brand-gradient' : ''} size="lg" />
      </button>
    </Tooltip>
  );
}
