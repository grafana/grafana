import { createSelector } from '@reduxjs/toolkit';
import memoizeOne from 'memoize-one';
import { memo, useRef } from 'react';
import Skeleton from 'react-loading-skeleton';
import { useParams } from 'react-router-dom-v5-compat';

import { DashboardHit } from '@grafana/api-clients/rtkq/dashboard/v0alpha1';
import { t } from '@grafana/i18n';
import { featureEnabled } from '@grafana/runtime';
import { Alert, Column, InteractiveTable, Text, TextLink } from '@grafana/ui';
import { useSearchDashboardsAndFoldersQuery } from 'app/api/clients/dashboard/v0alpha1';
import { useGetFolderQueryFacade } from 'app/api/clients/folder/v1beta1/hooks';
import { Page } from 'app/core/components/Page/Page';
import { UpgradeBox } from 'app/core/components/Upgrade/UpgradeBox';
import config from 'app/core/config';
import { getNavModel } from 'app/core/selectors/navModel';
import { contextSrv } from 'app/core/services/context_srv';
import { GENERAL_FOLDER_TITLE, GENERAL_FOLDER_UID } from 'app/features/search/constants';
import { AccessControlAction } from 'app/types/accessControl';
import { StoreState, useSelector } from 'app/types/store';

import { extractErrorMessage } from '../../api/utils';

import TeamGroupSync, { TeamSyncUpgradeContent } from './TeamGroupSync';
import TeamPermissions from './TeamPermissions';
import TeamSettings from './TeamSettings';
import { useGetTeam } from './hooks';
import { getTeamLoadingNav } from './state/navModel';

type TeamPageRouteParams = {
  uid: string;
  page?: string;
};

enum PageTypes {
  Members = 'members',
  Settings = 'settings',
  Folders = 'folders',
  GroupSync = 'groupsync',
}

function getPageType(page: string | undefined): PageTypes | undefined {
  switch (page) {
    case PageTypes.Members:
      return PageTypes.Members;
    case PageTypes.Settings:
      return PageTypes.Settings;
    case PageTypes.Folders:
      return PageTypes.Folders;
    case PageTypes.GroupSync:
      return PageTypes.GroupSync;
    default:
      return undefined;
  }
}

const pageNavSelector = createSelector(
  [
    (state: StoreState) => state.navIndex,
    (_state: StoreState, pageName: PageTypes) => pageName,
    (_state: StoreState, _pageName: PageTypes, teamUid: string) => teamUid,
  ],
  (navIndex, pageName, teamUid) => {
    const teamLoadingNav = getTeamLoadingNav(pageName);
    return getNavModel(navIndex, `team-${pageName}-${teamUid}`, teamLoadingNav).main;
  }
);

const TeamPages = memo(() => {
  const isSyncEnabled = useRef(featureEnabled('teamsync'));
  const { uid: teamUid = '', page } = useParams<TeamPageRouteParams>();

  const { data: team, isLoading } = useGetTeam({ uid: teamUid });

  let defaultPage = PageTypes.Members;
  // With RBAC the settings page will always be available
  if (!team || !contextSrv.hasPermissionInMetadata(AccessControlAction.ActionTeamsPermissionsRead, team)) {
    defaultPage = PageTypes.Settings;
  }
  let currentPage = getPageType(page) ?? defaultPage;
  if (currentPage === PageTypes.Folders && !config.featureToggles.teamFolders) {
    currentPage = defaultPage;
  }
  const pageNav = useSelector((state) => pageNavSelector(state, currentPage, teamUid));

  const renderPage = () => {
    const canReadTeam = contextSrv.hasPermissionInMetadata(AccessControlAction.ActionTeamsRead, team!);
    const canReadTeamPermissions = contextSrv.hasPermissionInMetadata(
      AccessControlAction.ActionTeamsPermissionsRead,
      team!
    );
    const canWriteTeamPermissions = contextSrv.hasPermissionInMetadata(
      AccessControlAction.ActionTeamsPermissionsWrite,
      team!
    );

    switch (currentPage) {
      case PageTypes.Members:
        if (canReadTeamPermissions) {
          return <TeamPermissions team={team!} />;
        }
        return null;
      case PageTypes.Settings:
        return canReadTeam && <TeamSettings team={team!} />;
      case PageTypes.Folders:
        return canReadTeam && <TeamFolders teamUid={teamUid} />;
      case PageTypes.GroupSync:
        if (isSyncEnabled.current) {
          if (canReadTeamPermissions) {
            return <TeamGroupSync isReadOnly={!canWriteTeamPermissions} teamUid={teamUid} />;
          }
        } else if (config.featureToggles.featureHighlights) {
          return (
            <>
              <UpgradeBox featureName={'team sync'} featureId={'team-sync'} />
              <TeamSyncUpgradeContent />
            </>
          );
        }
    }

    return null;
  };

  return (
    <Page navId="teams" pageNav={pageNav}>
      <Page.Contents isLoading={isLoading}>{team && Object.keys(team).length !== 0 && renderPage()}</Page.Contents>
    </Page>
  );
});

TeamPages.displayName = 'TeamPages';

const getColumns = memoizeOne((): Array<Column<DashboardHit>> => {
  return [
    {
      id: 'title',
      header: t('teams.team-pages.team-folders.table.name', 'Name'),
      cell: ({ row: { original } }) => (
        <TextLink
          color="primary"
          inline={false}
          href={`/dashboards/f/${original.name}`}
          title={t('teams.team-pages.team-folders.open-folder', 'Open folder')}
        >
          /{original.title}
        </TextLink>
      ),
    },
    {
      id: 'folder',
      header: t('teams.team-pages.team-folders.table.parent-folder', 'Parent folder'),
      cell: ({ row: { original } }) => <ParentFolderCell parentUid={original.folder} />,
    },
  ];
});

const getSkeletonData = memoizeOne(() =>
  new Array(3).fill(null).map((_, index) => ({
    name: `loading-folder-${index}`,
    resource: 'folder',
    title: t('teams.team-pages.team-folders.loading', 'Loading...'),
  }))
);

function TeamFolders({ teamUid }: { teamUid: string }) {
  const { data, isLoading, error } = useSearchDashboardsAndFoldersQuery(
    { ownerReference: [`iam.grafana.app/Team/${teamUid}`], type: 'folder' },
    { skip: !teamUid }
  );

  const folders = data?.hits ?? [];

  if (error) {
    return (
      <Alert
        severity="error"
        title={t('teams.team-pages.team-folders.error-loading-folders', 'Could not load team folders')}
      >
        {extractErrorMessage(error)}
      </Alert>
    );
  }

  if (!isLoading && !folders.length) {
    return <Text color="secondary">{t('teams.team-pages.team-folders.empty', 'No folders owned by this team')}</Text>;
  }

  return (
    <InteractiveTable
      columns={getColumns()}
      data={isLoading ? getSkeletonData() : folders}
      getRowId={(folder) => folder.name}
      pageSize={25}
    />
  );
}

function ParentFolderCell({ parentUid }: { parentUid?: string }) {
  // Not having a parent folder on a resource is the same as being in root or general folder but in case somebody just
  // passes general folder UID explicitly let's normalize that a bit
  if (parentUid === GENERAL_FOLDER_UID) {
    parentUid = undefined;
  }

  // If parentUid is undefined, this just skips
  const { data: parentFolder, isLoading, isError } = useGetFolderQueryFacade(parentUid);

  if (isLoading) {
    return <Skeleton width={100} />;
  }

  if (isError) {
    // No better error handling here. This is not blocking anything if not shown.
    return <>-</>;
  }

  return (
    <TextLink
      color="primary"
      inline={false}
      href={`/dashboards/f/${parentUid ?? GENERAL_FOLDER_UID}`}
      title={t('teams.team-pages.team-folders.open-parent-folder', 'Open parent folder')}
    >
      /{parentFolder?.title ?? GENERAL_FOLDER_TITLE}
    </TextLink>
  );
}

export default TeamPages;
