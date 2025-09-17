import { EntityState, createSelector } from '@reduxjs/toolkit';

import { Invitee } from 'app/types/user';

import { selectors } from './reducers';

export const { selectAll, selectById, selectTotal } = selectors;

const selectQuery = (_state: EntityState<Invitee, string>, query: string) => query;
export const selectInvitesMatchingQuery = createSelector([selectAll, selectQuery], (invites, searchQuery) => {
  const regex = new RegExp(searchQuery, 'i');
  const matches = invites.filter((invite) => regex.test(invite.name) || regex.test(invite.email));
  return matches;
});
