import { Team, TeamPermissionLevel } from 'app/types';
import config from 'app/core/config';
import { NavModelItem, NavModel } from '@grafana/data';

export function buildNavModel(team: Team): NavModelItem {
  const navModel = {
    img: team.avatarUrl,
    id: 'team-' + team.id,
    subTitle: 'Manage members & settings',
    url: '',
    text: team.name,
    breadcrumbs: [{ title: 'Teams', url: 'org/teams' }],
    children: [
      {
        active: false,
        icon: 'gicon gicon-team',
        id: `team-members-${team.id}`,
        text: 'Members',
        url: `org/teams/edit/${team.id}/members`,
      },
      {
        active: false,
        icon: 'fa fa-fw fa-sliders',
        id: `team-settings-${team.id}`,
        text: 'Settings',
        url: `org/teams/edit/${team.id}/settings`,
      },
    ],
  };

  if (config.licenseInfo.hasLicense) {
    navModel.children.push({
      active: false,
      icon: 'fa fa-fw fa-refresh',
      id: `team-groupsync-${team.id}`,
      text: 'External group sync',
      url: `org/teams/edit/${team.id}/groupsync`,
    });
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
  for (const child of main.children) {
    if (child.id.indexOf(pageName) > 0) {
      child.active = true;
      node = child;
      break;
    }
  }

  return {
    main: main,
    node: node,
  };
}
