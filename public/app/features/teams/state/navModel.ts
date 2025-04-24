import { NavModelItem, NavModel } from '@grafana/data';
import { featureEnabled } from '@grafana/runtime';
import { ProBadge } from 'app/core/components/Upgrade/ProBadge';
import config from 'app/core/config';
import { contextSrv } from 'app/core/services/context_srv';
import { highlightTrial } from 'app/features/admin/utils';
import { AccessControlAction, Team, TeamPermissionLevel } from 'app/types';

const loadingTeam = {
  avatarUrl: 'public/img/user_profile.png',
  id: 1,
  uid: '',
  name: 'Loading',
  email: 'loading',
  memberCount: 0,
  permission: TeamPermissionLevel.Member,
  accessControl: { isEditor: false },
  orgId: 0,
  updated: '',
  isProvisioned: false,
};

export function buildNavModel(team: Team): NavModelItem {
  const navModel: NavModelItem = {
    img: team.avatarUrl,
    id: 'team-' + team.uid,
    subTitle: 'Manage members and settings',
    url: `org/teams/edit/${team.uid}`,
    text: team.name,
    children: [
      // With RBAC this tab will always be available (but not always editable)
      // With Legacy it will be hidden by hideTabsFromNonTeamAdmin should the user not be allowed to see it
      {
        active: false,
        icon: 'sliders-v-alt',
        id: `team-settings-${team.uid}`,
        text: 'Settings',
        url: `org/teams/edit/${team.uid}/settings`,
      },
    ],
  };

  // While team is loading we leave the members tab
  // With RBAC the Members tab is available when user has ActionTeamsPermissionsRead for this team
  // With Legacy it will always be present
  if (
    team === loadingTeam ||
    contextSrv.hasPermissionInMetadata(AccessControlAction.ActionTeamsPermissionsRead, team)
  ) {
    navModel.children!.unshift({
      active: false,
      icon: 'users-alt',
      id: `team-members-${team.uid}`,
      text: 'Members',
      url: `org/teams/edit/${team.uid}/members`,
    });
  }

  const teamGroupSync: NavModelItem = {
    active: false,
    icon: 'sync',
    id: `team-groupsync-${team.uid}`,
    text: 'External group sync',
    url: `org/teams/edit/${team.uid}/groupsync`,
  };

  const isLoadingTeam = team === loadingTeam;

  if (highlightTrial()) {
    teamGroupSync.tabSuffix = () =>
      ProBadge({ experimentId: isLoadingTeam ? '' : 'feature-highlights-team-sync-badge', eventVariant: 'trial' });
  }

  // With both Legacy and RBAC the tab is protected being featureEnabled
  // While team is loading we leave the teamsync tab
  // With RBAC the External Group Sync tab is available when user has ActionTeamsPermissionsRead for this team
  if (featureEnabled('teamsync')) {
    if (isLoadingTeam || contextSrv.hasPermissionInMetadata(AccessControlAction.ActionTeamsPermissionsRead, team)) {
      navModel.children!.push(teamGroupSync);
    }
  } else if (config.featureToggles.featureHighlights) {
    navModel.children!.push({
      ...teamGroupSync,
      tabSuffix: () => ProBadge({ experimentId: isLoadingTeam ? '' : 'feature-highlights-team-sync-badge' }),
    });
  }

  return navModel;
}

export function getTeamLoadingNav(pageName: string): NavModel {
  const main = buildNavModel(loadingTeam);

  let node: NavModelItem;

  // find active page
  for (const child of main.children!) {
    if (child.id!.indexOf(pageName) > 0) {
      child.active = true;
      node = child;
      break;
    }
  }

  return {
    main: main,
    node: node!,
  };
}
