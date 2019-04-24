export const getUsers = state => {
  const regex = new RegExp(state.searchQuery, 'i');

  return state.users.filter(user => {
    return regex.test(user.login) || regex.test(user.email);
  });
};

export const getInvitees = state => {
  const regex = new RegExp(state.searchQuery, 'i');

  return state.invitees.filter(invitee => {
    return regex.test(invitee.name) || regex.test(invitee.email);
  });
};

export const getInviteesCount = state => state.invitees.length;
export const getUsersSearchQuery = state => state.searchQuery;
