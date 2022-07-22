import { createSelector } from '@reduxjs/toolkit';

import { selectors } from './reducers';

export const { selectAll, selectById, selectTotal } = selectors;

const selectQuery = (_: any, query: string) => query;
export const selectInvitesMatchingQuery = createSelector([selectAll, selectQuery], (invites, searchQuery) => {
  const regex = new RegExp(searchQuery, 'i');
  const matches = invites.filter((invite) => regex.test(invite.name) || regex.test(invite.email));
  return matches;
});
