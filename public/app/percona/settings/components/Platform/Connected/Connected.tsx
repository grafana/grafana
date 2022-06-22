import { LoaderButton, logger, TextInputField } from '@percona/platform-core';
import React, { FC, useState } from 'react';
import { Form } from 'react-final-form';
import { useDispatch, useSelector } from 'react-redux';

import { AppEvents } from '@grafana/data';
import { useStyles } from '@grafana/ui';
import { appEvents } from 'app/core/app_events';
import { fetchSettingsAction } from 'app/percona/shared/core/reducers';
import { getPerconaServer } from 'app/percona/shared/core/selectors';

import { Messages as PlatformMessages } from '../Platform.messages';
import { PlatformService } from '../Platform.service';

import { Messages } from './Connected.messages';
import { getStyles } from './Connected.styles';

export const Connected: FC = () => {
  const styles = useStyles(getStyles);
  const dispatch = useDispatch();
  const [disconnecting, setDisconnecting] = useState(false);
  const { serverId = '', serverName = '' } = useSelector(getPerconaServer);

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await PlatformService.disconnect();
      appEvents.emit(AppEvents.alertSuccess, [Messages.disconnectSucceeded]);
      dispatch(fetchSettingsAction());
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
      <Form
        initialValues={{ pmmServerId: serverId, pmmServerName: serverName }}
        onSubmit={() => {}}
        render={() => (
          <form>
            <TextInputField name="pmmServerId" disabled label={PlatformMessages.pmmServerId} />
            <TextInputField name="pmmServerName" disabled label={PlatformMessages.pmmServerName} />
          </form>
        )}
      />
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
