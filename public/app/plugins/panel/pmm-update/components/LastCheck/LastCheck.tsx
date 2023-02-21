import React, { FC } from 'react';

import { Button, IconName } from '@grafana/ui';

import { LastCheckProps } from '../../types';

import { Messages } from './LastCheck.messages';
import * as styles from './LastCheck.styles';

export const LastCheck: FC<LastCheckProps> = ({ lastCheckDate, onCheckForUpdates, disabled = false }) => (
  <div className={styles.lastCheck}>
    <p>
      {Messages.lastCheck}
      <span data-testid="update-last-check">{lastCheckDate}</span>
    </p>
    <Button
      data-testid="update-last-check-button"
      fill="text"
      size="sm"
      onClick={onCheckForUpdates}
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      icon={'fa fa-refresh' as IconName}
      disabled={disabled}
    />
  </div>
);
