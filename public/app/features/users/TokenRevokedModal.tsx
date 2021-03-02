import React from 'react';
import { Button, Modal } from '@grafana/ui';
import config from 'app/core/config';

interface Props {}

interface State {}

export class TokenRevokedModal extends React.Component<Props, State> {
  redirectToLogin() {
    window.location.href = config.appSubUrl + '/';
  }

  render() {
    return (
      <Modal title="Token revoked" isOpen={true} onDismiss={this.redirectToLogin} onClickBackdrop={() => {}}>
        <p>Your token has been revoked because you have reached the maximum amount of concurrent sessions.</p>
        <p>Please, log in again.</p>
        <div className="gf-form-group">
          <Button size="md" variant="primary" onClick={this.redirectToLogin}>
            Go to login
          </Button>
        </div>
      </Modal>
    );
  }
}
