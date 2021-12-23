import { LoaderButton, logger } from '@percona/platform-core';
import React, { FC, useState } from 'react';

import { AppEvents } from '@grafana/data';
import { useStyles } from '@grafana/ui';
import { appEvents } from 'app/core/app_events';

import { PlatformService } from '../Platform.service';
import { ConnectedProps } from '../types';

import { Messages } from './Connected.messages';
import { getStyles } from './Connected.styles';

export const Connected: FC<ConnectedProps> = ({ getSettings }) => {
  const styles = useStyles(getStyles);
  const [disconnecting, setDisconnecting] = useState(false);

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await PlatformService.disconnect();
      getSettings();
      appEvents.emit(AppEvents.alertSuccess, [Messages.disconnectSucceeded]);
    } catch (e) {
      logger.error(e);
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <section data-testid="connected-wrapper" className={styles.wrapper}>
      <header className={styles.title}>{Messages.title}</header>
      <p>{Messages.connected}</p>
      <LoaderButton
        data-testid="disconnect-button"
        size="md"
        variant="primary"
        disabled={disconnecting}
        loading={disconnecting}
        onClick={handleDisconnect}
      >
        {Messages.disconnect}
      </LoaderButton>
    </section>
  );
};
