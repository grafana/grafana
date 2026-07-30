import { AccessControlAction } from 'app/types/accessControl';

import { NavID, NavWeight } from '../constants';
import { has, isSignedIn, type NavEntryBuilder } from '../utils';

// Both are empty containers filled at runtime (starred dashboards by
// useSyncStarredItemsInNav, bookmarks from preferences), same as with the
// server-built tree.

export const starredNavEntry: NavEntryBuilder = {
  when: () => has(AccessControlAction.DashboardsRead),
  build: () => ({
    text: 'Starred',
    id: NavID.starred,
    icon: 'star',
    sortWeight: NavWeight.savedItems,
    children: [],
    emptyMessageId: 'starred-empty',
    url: '/dashboards?starred',
  }),
};

export const bookmarksNavEntry: NavEntryBuilder = {
  when: isSignedIn,
  build: () => ({
    text: 'Bookmarks',
    id: NavID.bookmarks,
    icon: 'bookmark',
    sortWeight: NavWeight.bookmarks,
    children: [],
    emptyMessageId: 'bookmarks-empty',
    url: '/bookmarks',
  }),
};
