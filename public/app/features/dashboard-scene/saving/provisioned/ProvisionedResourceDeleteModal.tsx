import { Button, Modal } from '@grafana/ui';

import { FolderDataType } from '../../../browse-dashboards/api/browseDashboardsAPI';
import { DashboardScene } from '../../scene/DashboardScene';

export interface Props {
  onDismiss: () => void;
  resource: DashboardScene | FolderDataType;
}

export function ProvisionedResourceDeleteModal({ onDismiss, resource }: Props) {
  const type = isDashboard(resource) ? 'dashboard' : 'folder';
  return (
    <Modal isOpen={true} title="Cannot delete provisioned resource" onDismiss={onDismiss}>
      <>
        <p>
          This {type} is managed by version control and cannot be deleted. To remove it, delete it from the repository
          and synchronise to apply the changes.
        </p>
        {isDashboard(resource) && <p>File path: {resource.getPath()}</p>}
      </>

      <Modal.ButtonRow>
        <Button variant="primary" onClick={onDismiss}>
          OK
        </Button>
      </Modal.ButtonRow>
    </Modal>
  );
}

function isDashboard(resource: DashboardScene | FolderDataType): resource is DashboardScene {
  return resource instanceof DashboardScene;
}

export function isFolder(resource: DashboardScene | FolderDataType): resource is FolderDataType {
  return !isDashboard(resource);
}
