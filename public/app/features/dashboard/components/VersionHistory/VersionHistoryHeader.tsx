import React from 'react';
import noop from 'lodash/noop';
import { Icon } from '@grafana/ui';

type VersionHistoryHeaderProps = {
  isComparing?: boolean;
  onClick?: () => void;
  baseVersion?: number;
  newVersion?: number;
  isNewLatest?: boolean;
};

export const VersionHistoryHeader: React.FC<VersionHistoryHeaderProps> = ({
  isComparing = false,
  onClick = noop,
  baseVersion = 0,
  newVersion = 0,
  isNewLatest = false,
}) => (
  <h3 className="dashboard-settings__header">
    <span onClick={onClick} className={isComparing ? 'pointer' : ''}>
      Versions
    </span>
    {isComparing && (
      <span>
        <Icon name="angle-right" /> Comparing {baseVersion} <Icon name="arrows-h" /> {newVersion}{' '}
        {isNewLatest && <cite className="muted">(Latest)</cite>}
      </span>
    )}
  </h3>
);
