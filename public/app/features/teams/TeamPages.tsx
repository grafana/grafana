import { createSelector } from '@reduxjs/toolkit';
import { memo, useRef } from 'react';
import { useParams } from 'react-router-dom-v5-compat';

import { featureEnabled } from '@grafana/runtime';
import { Page } from 'app/core/components/Page/Page';
import { UpgradeBox } from 'app/core/components/Upgrade/UpgradeBox';
import config from 'app/core/config';
import { getNavModel } from 'app/core/selectors/navModel';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';
import { StoreState, useSelector } from 'app/types/store';

import { TeamFolders } from './TeamFolders';
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

export default TeamPages;
