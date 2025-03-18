import { Badge } from '@grafana/ui';

import { ManagerKind } from '../../../features/apiserver/types';
import { useIsProvisionedInstance } from '../../../features/provisioning/hooks/useIsProvisionedInstance';
import { NestedFolderDTO } from '../../../features/search/service/types';
import { FolderDTO, FolderListItemDTO } from '../../../types';

export interface Props {
  folder?: FolderListItemDTO | NestedFolderDTO | FolderDTO;
}

export function FolderRepo({ folder }: Props) {
  const isProvisionedInstance = useIsProvisionedInstance();
  if (!folder || folder.managedBy !== ManagerKind.Repo || isProvisionedInstance) {
    return null;
  }

  return <Badge text={'Provisioned'} color={'darkgrey'} />;
}
