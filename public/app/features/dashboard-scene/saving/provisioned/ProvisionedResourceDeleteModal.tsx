import { Button, Modal } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';

import { FolderDTO, FolderListItemDTO } from '../../../../types';
import { NestedFolderDTO } from '../../../search/service/types';
import { DashboardScene } from '../../scene/DashboardScene';

type FolderDataType = FolderListItemDTO | NestedFolderDTO | FolderDTO;

export interface Props {
  onDismiss: () => void;
  resource: DashboardScene | FolderDataType;
}

export function ProvisionedResourceDeleteModal({ onDismiss, resource }: Props) {
  return (
    <Modal
      isOpen={true}
      title={t(
        'dashboard-scene.provisioned-resource-delete-modal.title-cannot-delete-provisioned-resource',
        'Cannot delete provisioned resource'
      )}
      onDismiss={onDismiss}
    >
      <>
        <p>
          <Trans i18nKey="dashboard-scene.provisioned-resource-delete-modal.managed-by-version-control">
            This resource is managed by version control and cannot be deleted. To remove it, delete it from the
            repository and synchronise to apply the changes.
          </Trans>
        </p>
        {isDashboard(resource) && (
          <p>
            <Trans i18nKey="dashboard-scene.provisioned-resource-delete-modal.file-path">File path:</Trans>{' '}
            {resource.getPath()}
          </p>
        )}
      </>

      <Modal.ButtonRow>
        <Button variant="primary" onClick={onDismiss}>
          <Trans i18nKey="dashboard-scene.provisioned-resource-delete-modal.ok">OK</Trans>
        </Button>
      </Modal.ButtonRow>
    </Modal>
  );
}

function isDashboard(resource: DashboardScene | FolderDataType): resource is DashboardScene {
  return resource instanceof DashboardScene;
}
