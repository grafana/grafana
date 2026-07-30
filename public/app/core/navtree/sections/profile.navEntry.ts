import { type NavModelItem } from '@grafana/data';
import { config } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';

import { NavID, NavWeight } from '../constants';
import { buildEntries, isSignedIn, type NavEntryBuilder } from '../utils';

const PROFILE_CHILDREN: NavEntryBuilder[] = [
  {
    when: () => true,
    build: () => ({
      text: 'Profile',
      id: 'profile/settings',
      url: '/profile',
      icon: 'sliders-v-alt',
    }),
  },
  {
    when: () => true,
    build: () => ({
      text: 'Notification history',
      id: 'profile/notifications',
      url: '/profile/notifications',
      icon: 'bell',
    }),
  },
  {
    // Backend also checks cfg.DisableLogin, which is not exposed to the frontend
    when: () => !config.disableLoginForm,
    build: () => ({
      text: 'Change password',
      id: 'profile/password',
      url: '/profile/password',
      icon: 'lock',
    }),
  },
];

export const profileNavEntry: NavEntryBuilder = {
  when: () => config.profileEnabled && isSignedIn(),
  build: (): NavModelItem => {
    const { name, login, gravatarUrl } = contextSrv.user;

    return {
      text: name,
      subTitle: login !== name ? login : undefined,
      id: NavID.profile,
      img: gravatarUrl,
      url: '/profile',
      sortWeight: NavWeight.profile,
      children: buildEntries(PROFILE_CHILDREN),
      roundIcon: true,
    };
  },
};
