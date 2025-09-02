import { t } from '@grafana/i18n';
import { Badge, Stack } from '@grafana/ui';
import { ManagerKind } from 'app/features/apiserver/types';
import { useGetResourceRepositoryView } from 'app/features/provisioning/hooks/useGetResourceRepositoryView';
import { useIsProvisionedInstance } from 'app/features/provisioning/hooks/useIsProvisionedInstance';
import { getReadOnlyTooltipText } from 'app/features/provisioning/utils/repository';
import { DashboardViewItem } from 'app/features/search/types';
import { FolderDTO } from 'app/types/folders';

export interface Props {
  folder?: FolderDTO | DashboardViewItem;
}

export function FolderRepo({ folder }: Props) {
  // skip rendering if:
  // folder is not present
  // folder have parentUID
  // folder is not managed
  // if whole instance is provisioned
  const isProvisionedInstance = useIsProvisionedInstance();
  const skipRender =
    !folder ||
    Boolean('parentUID' in folder && folder.parentUID) ||
    folder.managedBy !== ManagerKind.Repo ||
    isProvisionedInstance;

  const { isReadOnlyRepo, repoType } = useGetResourceRepositoryView({
    folderName: skipRender ? undefined : folder?.uid,
    skipQuery: skipRender,
  });

  if (skipRender) {
    return null;
  }

  return (
    // badge with text and icon only has different height, we will need to adjust the layout using stretch
    <Stack direction="row" alignItems="stretch">
      {isReadOnlyRepo && (
        <Badge
          color="darkgrey"
          text={t('folder-repo.read-only-badge', 'Read only')}
          tooltip={getReadOnlyTooltipText({ isLocal: repoType === 'local' })}
        />
      )}
      <Badge
        title={t('folder-repo.provisioned-badge', 'Provisioned')}
        color="purple"
        icon="exchange-alt"
        tooltip={t('folder-repo.provisioned-badge', 'Provisioned')}
      />
    </Stack>
  );
}
