export interface LibraryCredential {
  id: number;
  name: string;
  type: 'aws' | 'azure';
}

export interface LibraryCredentialsState {
  libraryCredentials: LibraryCredential[];
  searchQuery: string;
  hasFetched: boolean;
}
