import { Team, TeamPermissionLevel } from 'app/types';
import { featureEnabled } from '@grafana/runtime';
import { NavModelItem, NavModel } from '@grafana/data';
import config from 'app/core/config';
import { ProBadge } from 'app/core/components/Upgrade/ProBadge';

export function buildNavModel(team: Team): NavModelItem {
  const navModel: NavModelItem = {
    img: team.avatarUrl,
    id: 'team-' + team.id,
    subTitle: 'Manage members and settings',
    url: '',
    text: team.name,
    breadcrumbs: [{ title: 'Teams', url: 'org/teams' }],
    children: [
      {
        active: false,
        icon: 'users-alt',
        id: `team-members-${team.id}`,
        text: 'Members',
        url: `org/teams/edit/${team.id}/members`,
      },
      {
        active: false,
        icon: 'sliders-v-alt',
        id: `team-settings-${team.id}`,
        text: 'Settings',
        url: `org/teams/edit/${team.id}/settings`,
      },
    ],
  };

  const teamGroupSync = {
    active: false,
    icon: 'sync',
    id: `team-groupsync-${team.id}`,
    text: 'External group sync',
    url: `org/teams/edit/${team.id}/groupsync`,
  };

  if (featureEnabled('teamsync')) {
    navModel.children!.push(teamGroupSync);
  } else if (config.featureHighlights.enabled) {
    navModel.children!.push({ ...teamGroupSync, tabSuffix: ProBadge });
  }

  return navModel;
}

export function getTeamLoadingNav(pageName: string): NavModel {
  const main = buildNavModel({
    avatarUrl: 'public/img/user_profile.png',
    id: 1,
    name: 'Loading',
    email: 'loading',
    memberCount: 0,
    permission: TeamPermissionLevel.Member,
  });

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
