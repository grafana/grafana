import { useQueryLibraryContext } from 'app/features/explore/QueryLibrary/QueryLibraryContext';
import { hasSavedQueryReadPermissions } from 'app/features/explore/QueryLibrary/utils/identity';

/** Shared by the block menu and the footer's split button so both hide saved-query entries together. */
export function useSavedQueriesAvailable(): boolean {
  const { queryLibraryEnabled } = useQueryLibraryContext();
  return queryLibraryEnabled && hasSavedQueryReadPermissions();
}
