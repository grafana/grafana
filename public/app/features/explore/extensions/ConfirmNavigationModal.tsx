import { ReactElement } from 'react';

import { locationUtil } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { Button, Modal, Stack } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';

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
      <Stack direction="column" gap={1}>
        <p>
          <Trans i18nKey="explore.confirm-navigation-modal.new-tab">
            Do you want to proceed in the current tab or open a new tab?
          </Trans>
        </p>
      </Stack>
      <Modal.ButtonRow>
        <Button onClick={onDismiss} fill="outline" variant="secondary">
          <Trans i18nKey="explore.confirm-navigation-modal.cancel">Cancel</Trans>
        </Button>
        <Button type="submit" variant="secondary" onClick={openInNewTab} icon="external-link-alt">
          <Trans i18nKey="explore.confirm-navigation-modal.open-in-new-tab">Open in new tab</Trans>
        </Button>
        <Button type="submit" variant="primary" onClick={openInCurrentTab} icon="apps">
          <Trans i18nKey="explore.confirm-navigation-modal.open">Open</Trans>
        </Button>
      </Modal.ButtonRow>
    </Modal>
  );
}
