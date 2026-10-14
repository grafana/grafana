import { SavedSearches } from '../../components/saved-searches/SavedSearches';

const noop = async () => {};

/**
 * Shown in place of ConnectedSavedSearches until the one-time legacy saved-search copy has
 * settled - same control, disabled/loading, so the toolbar doesn't shift once the real one
 * mounts.
 */
export function SavedSearchesLoadingPlaceholder({ query }: { query: string }) {
  return (
    <SavedSearches
      savedSearches={[]}
      currentSearchQuery={query}
      onSave={noop}
      onRename={noop}
      onDelete={noop}
      onSetDefault={noop}
      onApply={() => {}}
      isLoading
    />
  );
}
