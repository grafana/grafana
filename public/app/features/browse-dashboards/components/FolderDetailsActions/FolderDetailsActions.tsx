import { css } from '@emotion/css';
import { skipToken } from '@reduxjs/toolkit/query';

import { OwnerReference as OwnerReferenceType } from '@grafana/api-clients/rtkq/folder/v1beta1';
import { useGetTeamQuery } from '@grafana/api-clients/rtkq/iam/v0alpha1';
import { GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { config, reportInteraction } from '@grafana/runtime';
import { LinkButton, Stack, Text, useStyles2 } from '@grafana/ui';
import { CombinedFolder, useGetFolderQueryFacade } from 'app/api/clients/folder/v1beta1/hooks';
import { OwnerReference } from 'app/core/components/OwnerReferences/OwnerReference';
import { contextSrv } from 'app/core/services/context_srv';
import { useGetResourceRepositoryView } from 'app/features/provisioning/hooks/useGetResourceRepositoryView';
import { AccessControlAction } from 'app/types/accessControl';

import { getFolderPermissions } from '../../permissions';
import CreateNewButton from '../CreateNewButton';
import { FolderActionsButton } from '../FolderActionsButton';

export const FolderDetailsActions = ({ folderDTO }: { folderDTO?: CombinedFolder }) => {
  // Fetch the root (aka general) folder if we're not in a specific folder
  const { data: rootFolderDTO } = useGetFolderQueryFacade(folderDTO ? undefined : 'general');
  const { isReadOnlyRepo, repoType } = useGetResourceRepositoryView({ folderName: folderDTO?.uid });
  const { canCreateDashboards, canCreateFolders } = getFolderPermissions(folderDTO ?? rootFolderDTO);

  const handleButtonClickToRecentlyDeleted = () => {
    reportInteraction('grafana_browse_dashboards_page_button_to_recently_deleted', {
      origin: window.location.pathname === config.appSubUrl + '/dashboards' ? 'Dashboards' : 'Folder view',
    });
  };

  const canReadTeams = contextSrv.hasPermission(AccessControlAction.ActionTeamsRead);

  return (
    <Stack alignItems="center">
      {canReadTeams && config.featureToggles.teamFolders && folderDTO && 'ownerReferences' in folderDTO && (
        <FolderOwners ownerReferences={folderDTO.ownerReferences} />
      )}
      {config.featureToggles.restoreDashboards && (
        <LinkButton
          variant="secondary"
          href={config.appSubUrl + '/dashboard/recently-deleted'}
          onClick={handleButtonClickToRecentlyDeleted}
        >
          <Trans i18nKey="browse-dashboards.actions.button-to-recently-deleted">Recently deleted</Trans>
        </LinkButton>
      )}
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
  const teamOwnerReferences = ownerReferences?.filter((ref) => ref.kind === 'Team');
  const teamUid = teamOwnerReferences?.at(0)?.uid;
  const { data: team, isLoading: isLoadingTeam } = useGetTeamQuery(teamUid ? { name: teamUid } : skipToken);

  if (!teamOwnerReferences || teamOwnerReferences.length === 0 || isLoadingTeam || !team) {
    return null;
  }

  return (
    <div className={styles.folderOwnersContainer}>
      <Text>
        <Trans i18nKey="browse-dashboards.folder-owners.owned-by">Owned by:</Trans>
      </Text>
      <OwnerReference team={team} />
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  folderOwnersContainer: css({
    display: 'flex',
    flexDirection: 'row',
    height: theme.spacing(4),
    lineHeight: theme.spacing(4),
    padding: `0 ${theme.spacing(2)}`,
    gap: theme.spacing(1),
    borderRadius: theme.shape.radius.default,
    border: `1px solid ${theme.colors.border.strong}`,
  }),
});
