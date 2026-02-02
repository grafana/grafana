import { useCallback, useMemo } from 'react';

import {
  AdHocFiltersVariable,
  SceneComponentProps,
  SceneObjectBase,
  SceneObjectState,
  sceneGraph,
} from '@grafana/scenes';
import { useTimeRange, useVariableValues } from '@grafana/scenes-react';

import { SavedSearches } from '../../components/saved-searches/SavedSearches';
import { SavedSearch } from '../../components/saved-searches/savedSearchesSchema';
import { shouldUseTriageSavedSearches } from '../../featureToggles';
import { VARIABLES } from '../constants';
import { trackTriageSavedSearchApplied, useTriageSavedSearches } from '../hooks/useTriageSavedSearches';

import { applyTriageSavedSearchState, generateTriageUrl, serializeTriageState } from './triageSavedSearchUtils';

/**
 * State interface for TriageSavedSearchesControl.
 * Currently empty but can be extended for additional state needs.
 */
interface TriageSavedSearchesControlState extends SceneObjectState {}

/**
 * Scene control for managing saved searches on the Alert Activity (Triage) page.
 *
 * This control integrates with the Grafana Scenes framework and renders the
 * SavedSearches component, allowing users to save, apply, and manage search
 * configurations (filters, groupBy, time range).
 *
 * The control:
 * - Uses the useTriageSavedSearches hook for persistence
 * - Serializes current URL state when saving
 * - Applies saved searches by updating Scene variables
 * - Is gated behind the alertingTriageSavedSearches feature toggle
 */
export class TriageSavedSearchesControl extends SceneObjectBase<TriageSavedSearchesControlState> {
  public static Component = TriageSavedSearchesControlRenderer;
}

/**
 * React renderer for TriageSavedSearchesControl.
 *
 * Renders the SavedSearches UI component and handles the integration
 * between the Scene framework and the saved searches feature.
 */
function TriageSavedSearchesControlRenderer({ model }: SceneComponentProps<TriageSavedSearchesControl>) {
  const isEnabled = shouldUseTriageSavedSearches();

  const { savedSearches, isLoading, saveSearch, renameSearch, deleteSearch, setDefaultSearch } =
    useTriageSavedSearches();

  // Use Scene-aware hooks to get current state (triggers re-render on state change)
  const [timeRange] = useTimeRange();
  const [groupBy = []] = useVariableValues<string>(VARIABLES.groupBy);

  // Get the AdHocFiltersVariable directly to access raw filter objects
  // This is needed because useVariableValues returns the interpolated expression string,
  // not the individual filter objects we need for serialization
  const filtersVar = sceneGraph.lookupVariable(VARIABLES.filters, model);

  // Use useState() for reactive access to filter state (triggers re-render on filter change)
  const filtersState = filtersVar instanceof AdHocFiltersVariable ? filtersVar.useState() : undefined;
  const filters = filtersState?.filters;

  // Serialize Scene state to a query string (reactive to changes)
  const currentSearchQuery = useMemo(() => {
    return serializeTriageState(filters ?? [], groupBy, timeRange.raw);
  }, [timeRange, filters, groupBy]);

  /**
   * Apply a saved search by programmatically updating Scene variables.
   */
  const handleApplySearch = useCallback(
    (search: SavedSearch) => {
      applyTriageSavedSearchState(model, search.query);
      trackTriageSavedSearchApplied(search);
    },
    [model]
  );

  /**
   * Generate href for a saved search item.
   * This is used for the link in SavedSearchItem component.
   */
  const getHref = useCallback((search: SavedSearch): string => {
    return generateTriageUrl(search.query);
  }, []);

  // Don't render if feature is not enabled
  if (!isEnabled) {
    return null;
  }

  return (
    <SavedSearches
      savedSearches={savedSearches}
      currentSearchQuery={currentSearchQuery}
      onSave={saveSearch}
      onRename={renameSearch}
      onDelete={deleteSearch}
      onApply={handleApplySearch}
      onSetDefault={setDefaultSearch}
      isLoading={isLoading}
      getHref={getHref}
    />
  );
}
