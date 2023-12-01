import React, { ReactElement } from 'react';

import { locationUtil } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { Button, Modal, VerticalGroup } from '@grafana/ui';

type Props = {
  onDismiss: () => void;
  path: string;
  title: string;
};

export function ConfirmNavigationModal(props: Props): ReactElement {
  const { onDismiss, path, title } = props;
  const openInNewTab = () => {
    global.open(locationUtil.assureBaseUrl(path), '_blank');
    onDismiss();
  };
  const openInCurrentTab = () => locationService.push(path);

  return (
    <Modal title={title} isOpen onDismiss={onDismiss}>
      <VerticalGroup spacing="sm">
        <p>Do you want to proceed in the current tab or open a new tab?</p>
      </VerticalGroup>
      <Modal.ButtonRow>
        <Button onClick={onDismiss} fill="outline" variant="secondary">
          Cancel
        </Button>
        <Button type="submit" variant="secondary" onClick={openInNewTab} icon="external-link-alt">
          Open in new tab
        </Button>
        <Button type="submit" variant="primary" onClick={openInCurrentTab} icon="apps">
          Open
        </Button>
      </Modal.ButtonRow>
    </Modal>
  );
}
