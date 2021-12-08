import { LibraryCredentialsState } from 'app/types';

export const getLibraryCredentials = (state: LibraryCredentialsState) => {
  const regex = RegExp(state.searchQuery, 'i');

  return state.libraryCredentials.filter((key) => {
    return regex.test(key.name) || regex.test(key.type);
  });
};
