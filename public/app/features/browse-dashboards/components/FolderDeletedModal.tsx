import { Trans, t } from '@grafana/i18n';
import { Button, Modal } from '@grafana/ui';

interface Props {
  isOpen: boolean;
  onGoToDashboards: () => void;
}

/**
 * Shown by FolderCascadeStatusBanner once a folder's cascade delete is confirmed finished,
 * instead of silently redirecting away from a page that's about to 404 -- the button is the only
 * way past it (dismissing does the same thing) since there's nothing left on this page to look at
 * either way.
 */
export function FolderDeletedModal({ isOpen, onGoToDashboards }: Props) {
  return (
    <Modal
      title={t('browse-dashboards.folder-deleted-modal.title', 'Folder deleted')}
      isOpen={isOpen}
      onDismiss={onGoToDashboards}
    >
      <Trans i18nKey="browse-dashboards.folder-deleted-modal.body">
        This folder and everything inside it have been successfully deleted. You&apos;ll be taken back to the
        Dashboards page.
      </Trans>
      <Modal.ButtonRow>
        <Button onClick={onGoToDashboards} variant="primary">
          <Trans i18nKey="browse-dashboards.folder-deleted-modal.confirm">Go to Dashboards</Trans>
        </Button>
      </Modal.ButtonRow>
    </Modal>
  );
}
