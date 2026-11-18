import { type NavModelItem } from '@grafana/data';
import { config } from '@grafana/runtime';
import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { NavID, NavWeight } from '../constants';
import { buildEntries, isSignedIn, type NavEntryBuilder } from '../utils';

const PROFILE_CHILDREN: NavEntryBuilder[] = [
  {
    build: () => ({
      text: 'Profile',
      id: 'profile/settings',
      url: '/profile',
      icon: 'sliders-v-alt',
    }),
  },
  {
    build: () => ({
      text: 'Notification history',
      id: 'profile/notifications',
      url: '/profile/notifications',
      icon: 'bell',
    }),
  },
  {
    when: () =>
      getFeatureFlagClient().getBooleanValue(FlagKeys.PersonalAccessTokens, false) &&
      contextSrv.hasPermission(AccessControlAction.UsersTokensRead),
    build: () => ({
      text: 'Personal access tokens',
      id: 'profile/personal-access-tokens',
      url: '/profile/personal-access-tokens',
      icon: 'key-skeleton-alt',
    }),
  },
  {
    // Mirrors the Go AddChangePasswordLink(): the login form must be enabled
    // and login itself not disabled, else there is no valid change-password flow
    when: () => !config.disableLoginForm && !config.auth.disableLogin,
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
