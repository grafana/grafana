import { t } from '@grafana/i18n';
import { Badge } from '@grafana/ui';
import { useIsProvisionedInstance } from 'app/features/provisioning/hooks/useIsProvisionedInstance';
import { NestedFolderDTO } from 'app/features/search/service/types';
import { FolderDTO, FolderListItemDTO } from 'app/types/folders';

export interface Props {
  folder?: FolderListItemDTO | NestedFolderDTO | FolderDTO;
}

export function FolderRepo({ folder }: Props) {
  const isProvisionedInstance = useIsProvisionedInstance();

  if (!folder || ('parentUID' in folder && folder.parentUID) || !folder.managedBy || isProvisionedInstance) {
    return null;
  }

  return <Badge color="purple" icon="exchange-alt" tooltip={t('folder-repo.badge-tooltip', 'Provisioned')} />;
}
