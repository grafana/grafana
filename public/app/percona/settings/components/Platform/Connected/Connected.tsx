import { LoaderButton, logger, TextInputField } from '@percona/platform-core';
import React, { FC, useCallback, useState } from 'react';
import { Form } from 'react-final-form';
import { useSelector } from 'react-redux';

import { config } from '@grafana/runtime';
import { ConfirmModal, useStyles } from '@grafana/ui';
import { getPerconaServer } from 'app/percona/shared/core/selectors';

import { Messages as PlatformMessages } from '../Platform.messages';
import { PlatformService } from '../Platform.service';

import { Messages } from './Connected.messages';
import { getStyles } from './Connected.styles';

export const Connected: FC = () => {
  const styles = useStyles(getStyles);
  const [disconnecting, setDisconnecting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const { serverId = '', serverName = '' } = useSelector(getPerconaServer);

  const handleDisconnect = async () => {
    setDisconnecting(true);
    closeModal();
    try {
      await PlatformService.disconnect();
      setTimeout(() => {
        window.location.assign(`${config.appSubUrl}/logout`);
        return;
      }, 3000);
    } catch (e) {
      logger.error(e);
      setDisconnecting(false);
    }
  };

  const closeModal = useCallback(() => setShowModal(false), []);
  const openModal = useCallback(() => setShowModal(true), []);

  return (
    <>
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
          onClick={openModal}
        >
          {Messages.disconnect}
        </LoaderButton>
      </section>
      <ConfirmModal
        body={Messages.modalBody}
        confirmText={Messages.disconnect}
        isOpen={showModal}
        title={Messages.modalTitle}
        onDismiss={closeModal}
        onConfirm={handleDisconnect}
      />
    </>
  );
};
