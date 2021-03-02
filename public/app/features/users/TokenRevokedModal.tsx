import React from 'react';
import { Button, Modal } from '@grafana/ui';
import config from 'app/core/config';

export const TokenRevokedModal = () => {
  const redirectToLogin = () => {
    window.location.href = config.appSubUrl + '/';
  };

  return (
    <Modal title="Token revoked" isOpen={true} onDismiss={redirectToLogin} onClickBackdrop={() => {}}>
      <p>Your token has been revoked because you have reached the maximum amount of concurrent sessions.</p>
      <p>Please, log in again.</p>
      <Button size="md" variant="primary" onClick={redirectToLogin}>
        Go to login
      </Button>
    </Modal>
  );
};
