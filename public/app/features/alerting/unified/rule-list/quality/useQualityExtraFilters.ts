import { useCallback, useMemo } from 'react';

import { useURLSearchParams } from '../../hooks/useURLSearchParams';

import { type FindingType, type SeverityFilterValue } from './qualityFindingFilters';
import { QUALITY_PARAMS, parseQualitySearch } from './qualitySavedSearch';

export interface QualityExtraFilters {
  /** Selected severity tier, or "all". Persisted in the `qualitySeverity` URL param. */
  severity: SeverityFilterValue;
  /** Selected finding types. Persisted as repeated `qualityFinding` URL params. */
  findingTypes: FindingType[];
  /** True when either the severity or finding-type filter is active. */
  hasExtraFilters: boolean;
  setSeverity: (severity: SeverityFilterValue) => void;
  setFindingTypes: (findingTypes: FindingType[]) => void;
  /** Add the finding type if absent, remove it if present. */
  toggleFindingType: (findingType: FindingType) => void;
  /** Clear both the severity and finding-type filters from the URL. */
  clearExtraFilters: () => void;
}

/**
 * URL-backed severity and finding-type filters for the Alert quality tab. These live in their
 * own query params (`qualitySeverity`, `qualityFinding`) alongside the rules `search` param,
 * so they survive refresh and can be captured by saved searches.
 */
export function useQualityExtraFilters(): QualityExtraFilters {
  const [queryParams, updateQueryParams] = useURLSearchParams();

  // The query string fully describes the state; parse it through the shared decoder so URL and
  // saved-search parsing stay in lockstep.
  const { severity, findingTypes } = useMemo(() => parseQualitySearch(queryParams.toString()), [queryParams]);

  const setSeverity = useCallback(
    (next: SeverityFilterValue) => {
      updateQueryParams({ [QUALITY_PARAMS.severity]: next !== 'all' ? next : undefined });
    },
    [updateQueryParams]
  );

  const setFindingTypes = useCallback(
    (next: FindingType[]) => {
      updateQueryParams({ [QUALITY_PARAMS.finding]: next.length > 0 ? next : undefined });
    },
    [updateQueryParams]
  );

  const toggleFindingType = useCallback(
    (findingType: FindingType) => {
      const next = findingTypes.includes(findingType)
        ? findingTypes.filter((type) => type !== findingType)
        : [...findingTypes, findingType];
      setFindingTypes(next);
    },
    [findingTypes, setFindingTypes]
  );

  const clearExtraFilters = useCallback(() => {
    updateQueryParams({ [QUALITY_PARAMS.severity]: undefined, [QUALITY_PARAMS.finding]: undefined });
  }, [updateQueryParams]);

  const hasExtraFilters = severity !== 'all' || findingTypes.length > 0;

  return {
    severity,
    findingTypes,
    hasExtraFilters,
    setSeverity,
    setFindingTypes,
    toggleFindingType,
    clearExtraFilters,
  };
}
