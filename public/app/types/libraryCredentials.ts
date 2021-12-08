import { LibraryCredential } from '@grafana/data';

export interface LibraryCredentialsState {
  libraryCredentials: LibraryCredential[];
  searchQuery: string;
  hasFetched: boolean;
}
