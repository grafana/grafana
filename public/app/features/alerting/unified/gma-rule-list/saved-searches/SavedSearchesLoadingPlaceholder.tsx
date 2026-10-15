import { SavedSearches } from '../../components/saved-searches/SavedSearches';

const noop = async () => {};

/** Disabled stand-in for ConnectedSavedSearches until the legacy copy settles, so the toolbar doesn't shift. */
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
