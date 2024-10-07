import React, { FC } from 'react';

import { IconButton } from '@grafana/ui';

import { Messages } from './LastCheck.messages';
import { styles } from './LastCheck.styles';
import { LastCheckProps } from './LastCheck.types';

export const LastCheck: FC<LastCheckProps> = ({ lastCheckDate, onCheckForUpdates, disabled = false }) => (
  <div className={styles.container}>
    <p>
      {Messages.lastCheck}
      <span data-testid="update-last-check">{lastCheckDate}</span>
    </p>
    <IconButton
      name="sync"
      variant="primary"
      data-testid="update-last-check-button"
      aria-label={Messages.checkAriaLabel}
      disabled={disabled}
      onClick={onCheckForUpdates}
    />
  </div>
);
