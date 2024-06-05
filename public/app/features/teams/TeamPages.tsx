import { createSelector } from '@reduxjs/toolkit';
import { memo, useMemo, useRef } from 'react';
import { useParams } from 'react-router';
import { useAsync } from 'react-use';

import { featureEnabled } from '@grafana/runtime';
import { Page } from 'app/core/components/Page/Page';
import { UpgradeBox } from 'app/core/components/Upgrade/UpgradeBox';
import config from 'app/core/config';
import { getNavModel } from 'app/core/selectors/navModel';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction, StoreState, useDispatch, useSelector } from 'app/types';

import TeamGroupSync, { TeamSyncUpgradeContent } from './TeamGroupSync';
import TeamPermissions from './TeamPermissions';
import TeamSettings from './TeamSettings';
import { loadTeam } from './state/actions';
import { getTeamLoadingNav } from './state/navModel';
import { getTeam } from './state/selectors';

interface TeamPageRouteParams {
  id: string;
  page?: string;
}

enum PageTypes {
  Members = 'members',
  Settings = 'settings',
  GroupSync = 'groupsync',
}

const PAGES = ['members', 'settings', 'groupsync'];

const teamSelector = createSelector(
  [(state: StoreState) => state.team, (_: StoreState, teamId: number) => teamId],
  (team, teamId) => getTeam(team, teamId)
);

const pageNavSelector = createSelector(
  [
    (state: StoreState) => state.navIndex,
    (_state: StoreState, pageName: string) => pageName,
    (_state: StoreState, _pageName: string, teamId: number) => teamId,
  ],
  (navIndex, pageName, teamId) => {
    const teamLoadingNav = getTeamLoadingNav(pageName);
    return getNavModel(navIndex, `team-${pageName}-${teamId}`, teamLoadingNav).main;
  }
);

const TeamPages = memo(() => {
  const isSyncEnabled = useRef(featureEnabled('teamsync'));
  const params = useParams<TeamPageRouteParams>();
  const teamId = useMemo(() => parseInt(params.id, 10), [params]);
  const team = useSelector((state) => teamSelector(state, teamId));

  let defaultPage = 'members';
  // With RBAC the settings page will always be available
  if (!team || !contextSrv.hasPermissionInMetadata(AccessControlAction.ActionTeamsPermissionsRead, team)) {
    defaultPage = 'settings';
  }
  const pageName = params.page ?? defaultPage;
  const pageNav = useSelector((state) => pageNavSelector(state, pageName, teamId));

  const dispatch = useDispatch();
  const { loading: isLoading } = useAsync(async () => dispatch(loadTeam(teamId)), [teamId]);

  const renderPage = () => {
    const currentPage = PAGES.includes(pageName) ? pageName : PAGES[0];

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
      case PageTypes.Settings:
        return canReadTeam && <TeamSettings team={team!} />;
      case PageTypes.GroupSync:
        if (isSyncEnabled.current) {
          if (canReadTeamPermissions) {
            return <TeamGroupSync isReadOnly={!canWriteTeamPermissions} />;
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
