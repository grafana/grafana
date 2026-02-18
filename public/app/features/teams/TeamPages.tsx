import { css } from '@emotion/css';
import { createSelector } from '@reduxjs/toolkit';
import { memo, useRef } from 'react';
import Skeleton from 'react-loading-skeleton';
import { useParams } from 'react-router-dom-v5-compat';

import { DashboardHit } from '@grafana/api-clients/rtkq/dashboard/v0alpha1';
import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { featureEnabled } from '@grafana/runtime';
import { Link, List, Text, useStyles2 } from '@grafana/ui';
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

const PAGES = new Set(Object.values(PageTypes));
function isPage(value: string): value is PageTypes {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return PAGES.has(value as PageTypes);
}

const pageNavSelector = createSelector(
  [
    (state: StoreState) => state.navIndex,
    (_state: StoreState, pageName: string) => pageName,
    (_state: StoreState, _pageName: string, teamUid: string) => teamUid,
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
  const pageName = page ?? defaultPage;
  let currentPage = isPage(pageName) ? pageName : defaultPage;
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

function TeamFolders({ teamUid }: { teamUid: string }) {
  const styles = useStyles2(getStyles);
  const ownerReference = `iam.grafana.app/Team/${teamUid}`;
  const { data, isLoading } = useSearchDashboardsAndFoldersQuery(
    { ownerReference: [ownerReference], type: 'folder' },
    { skip: !teamUid }
  );

  const folders = data?.hits ?? [];

  if (isLoading) {
    return (
      <>
        <Skeleton />
        <Skeleton />
        <Skeleton />
      </>
    );
  }

  if (!folders.length) {
    return <Text color="secondary">{t('teams.team-pages.team-folders.empty', 'No folders owned by this team')}</Text>;
  }

  return (
    <List
      items={folders}
      getItemKey={(folder) => folder.name}
      className={styles.list}
      renderItem={(folder) => <TeamFolderListItem folder={folder} />}
    />
  );
}

function TeamFolderListItem({ folder }: { folder: DashboardHit }) {
  const parentUid = folder.folder;
  const shouldFetchParent = Boolean(parentUid && parentUid !== GENERAL_FOLDER_UID);
  const { data: parentFolder, isLoading } = useGetFolderQueryFacade(shouldFetchParent ? parentUid : undefined);

  const parentTitle = parentUid === GENERAL_FOLDER_UID ? GENERAL_FOLDER_TITLE : parentFolder?.title;

  return (
    <div>
      <Link href={`/dashboards/f/${folder.name}`}>{folder.title}</Link>
      <Text variant="bodySmall" color="secondary">
        {t('teams.team-pages.team-folders.parent-folder', 'Parent folder')}:{' '}
        {isLoading ? t('teams.team-pages.team-folders.loading', 'Loading...') : (parentTitle ?? '-')}
      </Text>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    list: css({
      '> li': {
        marginBottom: theme.spacing(1),
      },
    }),
  };
}

export default TeamPages;
