import { useCallback, useMemo } from 'react';

import {
  AdHocFiltersVariable,
  type SceneComponentProps,
  SceneObjectBase,
  type SceneObjectState,
  sceneGraph,
} from '@grafana/scenes';
import { useTimeRange, useVariableValues } from '@grafana/scenes-react';

import { SavedSearches } from '../../components/saved-searches/SavedSearches';
import { type SavedSearch, validateSearchName } from '../../components/saved-searches/savedSearchesSchema';
import { VARIABLES } from '../constants';
import { useTriagePredefinedOverrides } from '../hooks/useTriagePredefinedOverrides';
import { trackTriageSavedSearchApplied, useTriageSavedSearches } from '../hooks/useTriageSavedSearches';
import {
  TRIAGE_DEFAULT_PREDEFINED_SEARCH_ID,
  getTriagePredefinedSearches,
  isTriagePredefinedSearchId,
} from '../triagePredefinedSearches';

import {
  applyTriageSavedSearchState,
  generateTriageUrl,
  mergeTriageSavedSearches,
  serializeTriageState,
} from './triageSavedSearchUtils';

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
  const { savedSearches, isLoading, saveSearch, renameSearch, deleteSearch, setDefaultSearch } =
    useTriageSavedSearches();
  const {
    nameOverrides,
    dismissedIds,
    defaultSearchId,
    setNameOverride,
    dismissId,
    setDefaultSearchId,
    isLoading: predefinedOverridesLoading,
  } = useTriagePredefinedOverrides();

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

  // Effective default: explicit default ID, legacy isDefault from saved list, or predefined "grouped by folder"
  const effectiveDefaultId =
    defaultSearchId ?? savedSearches.find((s) => s.isDefault)?.id ?? TRIAGE_DEFAULT_PREDEFINED_SEARCH_ID;

  // Predefined list: exclude dismissed, apply custom names and effective isDefault
  const predefinedList = useMemo(
    () =>
      getTriagePredefinedSearches()
        .filter((s) => !dismissedIds.includes(s.id))
        .map((s) => ({
          ...s,
          name: nameOverrides[s.id] ?? s.name,
          isDefault: s.id === effectiveDefaultId,
        })),
    [dismissedIds, nameOverrides, effectiveDefaultId]
  );

  // User list: apply effective isDefault (so one default shows in UI whether predefined or user)
  const savedSearchesWithDefault = useMemo(
    () =>
      savedSearches.map((s) => ({
        ...s,
        isDefault: s.id === effectiveDefaultId,
      })),
    [savedSearches, effectiveDefaultId]
  );

  const mergedSavedSearches = useMemo(
    () => mergeTriageSavedSearches(predefinedList, savedSearchesWithDefault, effectiveDefaultId),
    [predefinedList, savedSearchesWithDefault, effectiveDefaultId]
  );

  const handleSave = useCallback(
    async (name: string, query: string) => {
      const error = validateSearchName(name, mergedSavedSearches);
      if (error) {
        throw { field: 'name' as const, message: error };
      }
      await saveSearch(name, query);
    },
    [mergedSavedSearches, saveSearch]
  );

  const handleRename = useCallback(
    async (id: string, newName: string) => {
      const error = validateSearchName(newName, mergedSavedSearches, id);
      if (error) {
        throw { field: 'name' as const, message: error };
      }
      if (isTriagePredefinedSearchId(id)) {
        await setNameOverride(id, newName);
      } else {
        await renameSearch(id, newName);
      }
    },
    [mergedSavedSearches, setNameOverride, renameSearch]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      if (isTriagePredefinedSearchId(id)) {
        await dismissId(id);
      } else {
        await deleteSearch(id);
      }
    },
    [dismissId, deleteSearch]
  );

  /** Set or clear default: persist default ID for any search (predefined or user), and keep generic hook in sync for user list. */
  const handleSetDefault = useCallback(
    async (id: string | null) => {
      await setDefaultSearchId(id);
      // Keep isDefault in user saved list in sync (generic hook only knows user list)
      await setDefaultSearch(id != null && !isTriagePredefinedSearchId(id) ? id : null);
    },
    [setDefaultSearchId, setDefaultSearch]
  );

  return (
    <SavedSearches
      savedSearches={mergedSavedSearches}
      currentSearchQuery={currentSearchQuery}
      onSave={handleSave}
      onRename={handleRename}
      onDelete={handleDelete}
      onApply={handleApplySearch}
      onSetDefault={handleSetDefault}
      isLoading={isLoading || predefinedOverridesLoading}
      getHref={getHref}
    />
  );
}
