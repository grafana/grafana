import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { NavID, NavWeight } from '../constants';
import { isSignedIn, type NavEntryBuilder } from '../utils';

// Both ship as empty containers, same as with the server-built tree. The Starred children never enter the redux
// tree: useNavTree derives them from the stars query. Bookmarks are filled from preferences.

export const starredNavEntry: NavEntryBuilder = {
  // TODO: Gate on the signed-in user, as Bookmarks is. Stars are of any kind now, so a user who can read no
  // dashboard can still have stars to list, and gets no section for them. The server-built tree has the same
  // gate. Both change in a separate PR.
  when: () => contextSrv.hasPermission(AccessControlAction.DashboardsRead),
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
