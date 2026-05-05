import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { type RichHistoryQuery } from 'app/types/explore';

import { supportedFeatures } from '../../../core/history/richHistoryStorageProvider';
import {
  deleteAllFromRichHistory,
  deleteQueryInRichHistory,
  getRichHistory,
  getRichHistorySettings,
  updateCommentInRichHistory,
  updateRichHistorySettings,
  updateStarredInRichHistory,
} from '../../../core/utils/richHistory';
import {
  type RichHistorySearchFilters,
  type RichHistorySettings,
  SortOrder,
} from '../../../core/utils/richHistoryTypes';

type RichHistorySupportedFeatures = ReturnType<typeof supportedFeatures>;

export interface RecentQueriesContextType {
  // Data
  queries: RichHistoryQuery[];
  totalQueries: number;
  isLoading: boolean;
  settingsLoaded: boolean;
  settings: RichHistorySettings;
  selectedQuery: RichHistoryQuery | null;
  supportedFeatures: RichHistorySupportedFeatures;

  // Filters
  filters: RichHistorySearchFilters;
  updateFilters: (partial: Partial<RichHistorySearchFilters>) => void;

  // Operations
  loadQueries: () => Promise<void>;
  loadMore: () => Promise<void>;
  starQuery: (id: string, starred: boolean) => Promise<void>;
  deleteQuery: (id: string) => Promise<void>;
  updateComment: (id: string, comment: string) => Promise<void>;
  deleteAll: () => Promise<void>;

  // UI state
  selectQuery: (query: RichHistoryQuery | null) => void;
  updateSettings: (settings: Partial<RichHistorySettings>) => Promise<void>;
}

const DEFAULT_SETTINGS: RichHistorySettings = {
  retentionPeriod: 14,
  starredTabAsFirstTab: false,
  activeDatasourcesOnly: false,
};

const DEFAULT_FILTERS: RichHistorySearchFilters = {
  search: '',
  sortOrder: SortOrder.Descending,
  datasourceFilters: [],
  from: 0,
  to: 14,
  starred: false,
  page: 1,
};

const noop = () => Promise.resolve();

export const RecentQueriesContext = createContext<RecentQueriesContextType>({
  queries: [],
  totalQueries: 0,
  isLoading: false,
  settingsLoaded: false,
  settings: DEFAULT_SETTINGS,
  selectedQuery: null,
  supportedFeatures: supportedFeatures(),

  filters: DEFAULT_FILTERS,
  updateFilters: () => {},

  loadQueries: noop,
  loadMore: noop,
  starQuery: noop,
  deleteQuery: noop,
  updateComment: noop,
  deleteAll: noop,

  selectQuery: () => {},
  updateSettings: noop,
});

export function useRecentQueriesContext() {
  return useContext(RecentQueriesContext);
}

export function RecentQueriesProvider({ children }: { children: ReactNode }) {
  const [queries, setQueries] = useState<RichHistoryQuery[]>([]);
  const [totalQueries, setTotalQueries] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [settings, setSettings] = useState<RichHistorySettings>(DEFAULT_SETTINGS);
  const [selectedQuery, setSelectedQuery] = useState<RichHistoryQuery | null>(null);
  const [filters, setFilters] = useState<RichHistorySearchFilters>(DEFAULT_FILTERS);

  // Load settings on mount
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const loadedSettings = await getRichHistorySettings();
        if (cancelled) {
          return;
        }
        setSettings(loadedSettings);
        setFilters((prev) => ({ ...prev, to: loadedSettings.retentionPeriod }));
      } catch {
        // Settings load failed; keep defaults
      } finally {
        if (!cancelled) {
          setSettingsLoaded(true);
        }
      }
    }

    init();

    return () => {
      cancelled = true;
    };
  }, []);

  const loadQueries = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getRichHistory(filters);
      setQueries(result.richHistory);
      setTotalQueries(result.total ?? result.richHistory.length);
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  const loadMore = useCallback(async () => {
    const nextPage = (filters.page ?? 1) + 1;
    setIsLoading(true);
    try {
      const result = await getRichHistory({ ...filters, page: nextPage });
      setQueries((prev) => [...prev, ...result.richHistory]);
      setTotalQueries(result.total ?? result.richHistory.length);
      setFilters((prev) => ({ ...prev, page: nextPage }));
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  const updateFiltersCallback = useCallback((partial: Partial<RichHistorySearchFilters>) => {
    setFilters((prev) => ({ ...prev, ...partial, page: 1 }));
  }, []);

  const starQuery = useCallback(async (id: string, starred: boolean) => {
    const result = await updateStarredInRichHistory(id, starred);
    if (result !== undefined) {
      setQueries((prev) => prev.map((q) => (q.id === id ? { ...q, starred } : q)));
      setSelectedQuery((prev) => (prev?.id === id ? { ...prev, starred } : prev));
    }
  }, []);

  const deleteQuery = useCallback(async (id: string) => {
    const result = await deleteQueryInRichHistory(id);
    if (result !== undefined) {
      setQueries((prev) => prev.filter((q) => q.id !== id));
      setTotalQueries((prev) => Math.max(0, prev - 1));
      setSelectedQuery((prev) => (prev?.id === id ? null : prev));
    }
  }, []);

  const updateComment = useCallback(async (id: string, comment: string) => {
    const result = await updateCommentInRichHistory(id, comment);
    if (result !== undefined) {
      setQueries((prev) => prev.map((q) => (q.id === id ? { ...q, comment } : q)));
      setSelectedQuery((prev) => (prev?.id === id ? { ...prev, comment } : prev));
    }
  }, []);

  const deleteAll = useCallback(async () => {
    await deleteAllFromRichHistory();
    setQueries([]);
    setTotalQueries(0);
    setSelectedQuery(null);
  }, []);

  const selectQuery = useCallback((query: RichHistoryQuery | null) => {
    setSelectedQuery(query);
  }, []);

  const updateSettingsCallback = useCallback(
    async (partial: Partial<RichHistorySettings>) => {
      const merged = { ...settings, ...partial };
      setSettings(merged);
      await updateRichHistorySettings(merged);
    },
    [settings]
  );

  const features = useMemo(() => supportedFeatures(), []);

  const value = useMemo<RecentQueriesContextType>(
    () => ({
      queries,
      totalQueries,
      isLoading,
      settingsLoaded,
      settings,
      selectedQuery,
      supportedFeatures: features,

      filters,
      updateFilters: updateFiltersCallback,

      loadQueries,
      loadMore,
      starQuery,
      deleteQuery,
      updateComment,
      deleteAll,

      selectQuery,
      updateSettings: updateSettingsCallback,
    }),
    [
      queries,
      totalQueries,
      isLoading,
      settingsLoaded,
      settings,
      selectedQuery,
      features,
      filters,
      updateFiltersCallback,
      loadQueries,
      loadMore,
      starQuery,
      deleteQuery,
      updateComment,
      deleteAll,
      selectQuery,
      updateSettingsCallback,
    ]
  );

  return <RecentQueriesContext.Provider value={value}>{children}</RecentQueriesContext.Provider>;
}
