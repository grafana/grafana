import { Badge } from '@grafana/ui';
import { t } from 'app/core/internationalization';
import { useIsProvisionedInstance } from 'app/features/provisioning/hooks/useIsProvisionedInstance';
import { NestedFolderDTO } from 'app/features/search/service/types';
import { FolderDTO, FolderListItemDTO } from 'app/types';

export interface Props {
  folder?: FolderListItemDTO | NestedFolderDTO | FolderDTO;
}

export function FolderRepo({ folder }: Props) {
  const isProvisionedInstance = useIsProvisionedInstance();
  if (!folder || ('parentUID' in folder && folder.parentUID) || !folder.managedBy || isProvisionedInstance) {
    return null;
  }

  return <Badge text={t('folder-repo.badge-text', 'Provisioned')} color={'darkgrey'} />;
}
