export const getMockNavModel = (pageName: string) => {
  return {
    node: {
      active: false,
      icon: 'users-alt',
      id: `team-${pageName}-2`,
      text: `${pageName}`,
      url: 'org/teams/edit/2/members',
      parentItem: {
        img: '/avatar/b5695b61c91d13e7fa2fe71cfb95de9b',
        id: 'team-2',
        subTitle: 'Manage members & settings',
        url: '',
        text: 'test1',
        breadcrumbs: [{ title: 'Teams', url: 'org/teams' }],
        children: [
          {
            active: false,
            icon: 'users-alt',
            id: 'team-members-2',
            text: 'Members',
            url: 'org/teams/edit/2/members',
          },
          {
            active: false,
            icon: 'sliders-v-alt',
            id: 'team-settings-2',
            text: 'Settings',
            url: 'org/teams/edit/2/settings',
          },
        ],
      },
    },
    main: {
      img: '/avatar/b5695b61c91d13e7fa2fe71cfb95de9b',
      id: 'team-2',
      subTitle: 'Manage members & settings',
      url: '',
      text: 'test1',
      breadcrumbs: [{ title: 'Teams', url: 'org/teams' }],
      children: [
        {
          active: true,
          icon: 'users-alt',
          id: 'team-members-2',
          text: 'Members',
          url: 'org/teams/edit/2/members',
        },
        {
          active: false,
          icon: 'sliders-v-alt',
          id: 'team-settings-2',
          text: 'Settings',
          url: 'org/teams/edit/2/settings',
        },
      ],
    },
  };
};
