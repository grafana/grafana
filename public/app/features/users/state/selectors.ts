import { type UsersState } from 'app/types/user';

// The server filters all pages; keep its last result while the next search is debounced or loading.
export const getUsers = (state: UsersState) => state.users;

export const getUsersSearchQuery = (state: UsersState) => state.searchQuery;
