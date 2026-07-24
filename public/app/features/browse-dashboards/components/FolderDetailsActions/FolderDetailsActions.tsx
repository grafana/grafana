import { css } from '@emotion/css';

import { type OwnerReference as OwnerReferenceType } from '@grafana/api-clients/rtkq/folder/v1beta1';
import { type GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { config, reportInteraction } from '@grafana/runtime';
import { LinkButton, Stack, Text, useStyles2 } from '@grafana/ui';
import { type CombinedFolder, useGetFolderQueryFacade } from 'app/api/clients/folder/v1beta1/hooks';
import { OwnerReference } from 'app/core/components/OwnerReferences/OwnerReference';
import { contextSrv } from 'app/core/services/context_srv';
import { useGetResourceRepositoryView } from 'app/features/provisioning/hooks/useGetResourceRepositoryView';
import { STARRED_FOLDERS_UID } from 'app/features/search/constants';
import { StarToolbarButton } from 'app/features/stars/StarToolbarButton';
import { useGetTeamByUidQuery } from 'app/features/teams/hooks';
import { AccessControlAction } from 'app/types/accessControl';
import { useDispatch } from 'app/types/store';

import { PAGE_SIZE } from '../../api/constants';
import { getFolderPermissions } from '../../permissions';
import { refetchChildren } from '../../state/actions';
import { starredFoldersEnabled } from '../../utils/dashboards';
import CreateNewButton from '../CreateNewButton';
import { FolderActionsButton } from '../FolderActionsButton';

export const FolderDetailsActions = ({ folderDTO }: { folderDTO?: CombinedFolder }) => {
  // Fetch the root (aka general) folder if we're not in a specific folder
  const { data: rootFolderDTO } = useGetFolderQueryFacade(folderDTO ? undefined : 'general');
  const { isReadOnlyRepo, repoType } = useGetResourceRepositoryView({ folderName: folderDTO?.uid });
  const { canCreateDashboards, canCreateFolders } = getFolderPermissions(folderDTO ?? rootFolderDTO);
  const dispatch = useDispatch();

  // Stars and the browse-dashboards "Starred folders" row use independent caches, so refetch the
  // virtual folder's children when a folder is starred/unstarred to keep the browse list in sync.
  const handleStarChange = () => {
    dispatch(refetchChildren({ parentUID: STARRED_FOLDERS_UID, pageSize: PAGE_SIZE }));
  };

  const handleButtonClickToRecentlyDeleted = () => {
    reportInteraction('grafana_browse_dashboards_page_button_to_recently_deleted', {
      origin: window.location.pathname === config.appSubUrl + '/dashboards' ? 'Dashboards' : 'Folder view',
    });
  };

  const canReadTeams = contextSrv.hasPermission(AccessControlAction.ActionTeamsRead);

  return (
    <Stack alignItems="center">
      {starredFoldersEnabled() && folderDTO && (
        <StarToolbarButton
          group="folder.grafana.app"
          kind="Folder"
          id={folderDTO.uid}
          title={folderDTO.title}
          onStarChange={handleStarChange}
        />
      )}
      {canReadTeams && folderDTO && 'ownerReferences' in folderDTO && (
        <FolderOwners ownerReferences={folderDTO.ownerReferences} />
      )}
      <LinkButton
        variant="secondary"
        href={config.appSubUrl + '/dashboard/recently-deleted'}
        onClick={handleButtonClickToRecentlyDeleted}
      >
        <Trans i18nKey="browse-dashboards.actions.button-to-recently-deleted">Recently deleted</Trans>
      </LinkButton>
      {folderDTO && <FolderActionsButton folder={folderDTO} repoType={repoType} isReadOnlyRepo={isReadOnlyRepo} />}
      {(canCreateDashboards || canCreateFolders) && (
        <CreateNewButton
          parentFolder={folderDTO}
          canCreateDashboard={canCreateDashboards}
          canCreateFolder={canCreateFolders}
          repoType={repoType}
          isReadOnlyRepo={isReadOnlyRepo}
        />
      )}
    </Stack>
  );
};

const FolderOwners = ({ ownerReferences }: { ownerReferences?: OwnerReferenceType[] }) => {
  const styles = useStyles2(getStyles);
  const teamOwnerReferences = ownerReferences?.filter((ref) => ref.kind === 'Team') ?? [];

  if (teamOwnerReferences.length === 0) {
    return null;
  }

  return (
    <div className={styles.folderOwnersContainer}>
      <Text>
        <Trans i18nKey="browse-dashboards.folder-owners.owned-by">Owned by:</Trans>
      </Text>
      <Stack direction="row" gap={1} wrap="wrap" alignItems="center">
        {teamOwnerReferences.map((ref) => (
          <FolderOwnerLink key={ref.uid} teamUid={ref.uid} />
        ))}
      </Stack>
    </div>
  );
};

const FolderOwnerLink = ({ teamUid }: { teamUid: string }) => {
  const { data: team, isLoading } = useGetTeamByUidQuery({ name: teamUid });

  if (isLoading || !team) {
    return null;
  }

  return <OwnerReference team={team} />;
};

const getStyles = (theme: GrafanaTheme2) => ({
  folderOwnersContainer: css({
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: theme.spacing(4),
    padding: `${theme.spacing(0.5)} ${theme.spacing(2)}`,
    gap: theme.spacing(1),
    borderRadius: theme.shape.radius.default,
    border: `1px solid ${theme.colors.border.strong}`,
  }),
});
