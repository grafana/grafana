import { useCallback, useEffect, useRef, useState } from 'react';

import { CommandPaletteDynamicFacet, CommandPaletteFacetValue } from './facetTypes';

export interface FacetState {
  /** Currently applied facet filters: facetId → selected valueId */
  activeFacets: Record<string, string>;
  /** Labels for active facet values (for breadcrumb display): facetId → label */
  activeFacetLabels: Record<string, string>;
  /** Which facet is currently being browsed (null = showing entity results) */
  selectingFacetId: string | null;
  /** Values available for the currently selected facet */
  facetValues: CommandPaletteFacetValue[];
  /** Whether facet values are being loaded */
  isLoadingFacetValues: boolean;
  /** Search query within facet value selection */
  facetSearchQuery: string;
  /** Filtered facet values based on facetSearchQuery */
  filteredFacetValues: CommandPaletteFacetValue[];
}

export interface FacetActions {
  /** Enter facet selection mode for a given facet */
  activateFacet: (facetId: string) => void;
  /** Select a value for the currently active facet, return to browsing */
  selectFacetValue: (valueId: string) => void;
  /** Remove a facet filter and all downstream facet filters */
  removeFacet: (facetId: string) => void;
  /** Clear all facet filters */
  resetFacets: () => void;
  /** Update the search query within facet value selection */
  setFacetSearchQuery: (query: string) => void;
  /** Go back from facet selection to browsing */
  cancelFacetSelection: () => void;
}

export function useFacetState(
  facets: CommandPaletteDynamicFacet[],
  entitySearchQuery: string
): FacetState & FacetActions {
  const [activeFacets, setActiveFacets] = useState<Record<string, string>>({});
  const [activeFacetLabels, setActiveFacetLabels] = useState<Record<string, string>>({});
  const [selectingFacetId, setSelectingFacetId] = useState<string | null>(null);
  const [facetValues, setFacetValues] = useState<CommandPaletteFacetValue[]>([]);
  const [isLoadingFacetValues, setIsLoadingFacetValues] = useState(false);
  const [facetSearchQuery, setFacetSearchQuery] = useState('');

  const abortRef = useRef<AbortController | null>(null);

  const filteredFacetValues =
    facetSearchQuery.length > 0
      ? facetValues.filter((v) => v.label.toLowerCase().includes(facetSearchQuery.toLowerCase()))
      : facetValues;

  const activateFacet = useCallback(
    (facetId: string) => {
      const facet = facets.find((f) => f.id === facetId);
      if (!facet) {
        return;
      }

      if (abortRef.current) {
        abortRef.current.abort();
      }

      setSelectingFacetId(facetId);
      setFacetSearchQuery('');
      setIsLoadingFacetValues(true);

      const controller = new AbortController();
      abortRef.current = controller;

      facet
        .getValues({
          searchQuery: entitySearchQuery,
          activeFacets,
          signal: controller.signal,
        })
        .then((values: CommandPaletteFacetValue[]) => {
          if (!controller.signal.aborted) {
            setFacetValues(values);
            setIsLoadingFacetValues(false);
          }
        })
        .catch((err: unknown) => {
          if (!controller.signal.aborted) {
            console.error('[CommandPalette] Failed to load facet values:', err);
            setFacetValues([]);
            setIsLoadingFacetValues(false);
          }
        });
    },
    [facets, activeFacets, entitySearchQuery]
  );

  const selectFacetValue = useCallback(
    (valueId: string) => {
      if (!selectingFacetId) {
        return;
      }

      const selectedValue = facetValues.find((v) => v.id === valueId);
      const label = selectedValue?.label ?? valueId;

      const facetIndex = facets.findIndex((f) => f.id === selectingFacetId);

      // Reset downstream facets when changing a facet value
      const newActiveFacets: Record<string, string> = {};
      const newLabels: Record<string, string> = {};
      for (let i = 0; i < facetIndex; i++) {
        const fId = facets[i].id;
        if (activeFacets[fId] !== undefined) {
          newActiveFacets[fId] = activeFacets[fId];
          newLabels[fId] = activeFacetLabels[fId];
        }
      }
      newActiveFacets[selectingFacetId] = valueId;
      newLabels[selectingFacetId] = label;

      setActiveFacets(newActiveFacets);
      setActiveFacetLabels(newLabels);
      setSelectingFacetId(null);
      setFacetValues([]);
      setFacetSearchQuery('');
    },
    [selectingFacetId, facetValues, facets, activeFacets, activeFacetLabels]
  );

  const removeFacet = useCallback(
    (facetId: string) => {
      const facetIndex = facets.findIndex((f) => f.id === facetId);
      if (facetIndex === -1) {
        return;
      }

      const newActiveFacets: Record<string, string> = {};
      const newLabels: Record<string, string> = {};
      for (let i = 0; i < facetIndex; i++) {
        const fId = facets[i].id;
        if (activeFacets[fId] !== undefined) {
          newActiveFacets[fId] = activeFacets[fId];
          newLabels[fId] = activeFacetLabels[fId];
        }
      }

      setActiveFacets(newActiveFacets);
      setActiveFacetLabels(newLabels);
    },
    [facets, activeFacets, activeFacetLabels]
  );

  const resetFacets = useCallback(() => {
    setActiveFacets({});
    setActiveFacetLabels({});
    setSelectingFacetId(null);
    setFacetValues([]);
    setFacetSearchQuery('');
  }, []);

  const cancelFacetSelection = useCallback(() => {
    setSelectingFacetId(null);
    setFacetValues([]);
    setFacetSearchQuery('');
  }, []);

  // Cancel pending requests on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  return {
    activeFacets,
    activeFacetLabels,
    selectingFacetId,
    facetValues,
    isLoadingFacetValues,
    facetSearchQuery,
    filteredFacetValues,
    activateFacet,
    selectFacetValue,
    removeFacet,
    resetFacets,
    setFacetSearchQuery,
    cancelFacetSelection,
  };
}
