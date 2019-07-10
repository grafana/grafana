export const getUsers = (state: any) => {
  const regex = new RegExp(state.searchQuery, 'i');

  return state.users.filter((user: any) => {
    return regex.test(user.login) || regex.test(user.email);
  });
};

export const getInvitees = (state: any) => {
  const regex = new RegExp(state.searchQuery, 'i');

  return state.invitees.filter((invitee: any) => {
    return regex.test(invitee.name) || regex.test(invitee.email);
  });
};

export const getInviteesCount = (state: any) => state.invitees.length;
export const getUsersSearchQuery = (state: any) => state.searchQuery;
