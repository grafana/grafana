import { useEffect, useMemo, useState } from 'react';

import {
  type PluginExtensionCommandPaletteSearchProvider,
  type PluginExtensionFunction,
  PluginExtensionPoints,
} from '@grafana/data';
import { usePluginFunctions } from '@grafana/runtime';

import { type ExtensionSearchSection, searchExtensionProviders } from './extensionSearch';

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 200;

export interface ExtensionSearchState {
  extensionSearchSections: ExtensionSearchSection[];
  isFetchingExtensionSearch: boolean;
}

export const NO_EXTENSION_SEARCH: ExtensionSearchState = {
  extensionSearchSections: [],
  isFetchingExtensionSearch: false,
};

interface QuerySection {
  /** The query the section answers, so a slow provider's old answer is never shown for a newer query. */
  query: string;
  section: ExtensionSearchSection;
}

/**
 * Query-driven search results contributed by app plugins. Each provider's section appears as soon as that
 * provider settles; `isFetchingExtensionSearch` stays true until all of them have.
 *
 * Subscribes to the extension point, which loads the plugins that register to it, so only mount it when
 * the feature is enabled.
 */
export function useExtensionSearchResults({
  searchQuery,
  show,
}: {
  searchQuery: string;
  show: boolean;
}): ExtensionSearchState {
  const { functions: latestFunctions, isLoading } = usePluginFunctions<PluginExtensionCommandPaletteSearchProvider>({
    extensionPointId: PluginExtensionPoints.CommandPaletteSearch,
    limitPerPlugin: 1,
  });
  const functions = useStableFunctions(latestFunctions);
  const [sections, setSections] = useState<QuerySection[]>([]);
  // The search the providers last finished, so fetching is derived instead of set from inside the effect.
  const [settled, setSettled] = useState<{ query: string; functions: typeof functions } | undefined>();

  const query = searchQuery.trim();
  const searching = show && query.length >= MIN_QUERY_LENGTH;
  const active = searching && functions.length > 0;

  // Drop results when searching stops, so they don't resurface for the next query.
  const [wasActive, setWasActive] = useState(active);
  if (wasActive !== active) {
    setWasActive(active);
    if (!active) {
      setSections([]);
      setSettled(undefined);
    }
  }

  useEffect(() => {
    if (!active) {
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => {
      searchExtensionProviders(functions, query, controller.signal, (section) => {
        if (!controller.signal.aborted) {
          setSections((previous) => [...previous.filter((s) => s.section.id !== section.id), { query, section }]);
        }
      }).then(() => {
        if (!controller.signal.aborted) {
          setSettled({ query, functions });
        }
      });
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [active, functions, query]);

  const extensionSearchSections = useMemo(() => {
    const position = (id: string) => functions.findIndex((f) => f.id === id);
    return sections
      .filter((s) => s.query === query && position(s.section.id) >= 0)
      .map((s) => s.section)
      .sort((a, b) => position(a.id) - position(b.id));
  }, [sections, functions, query]);

  // While plugins are still loading there are no providers to run yet, which must not look like "no results".
  const isFetchingExtensionSearch =
    (searching && isLoading) || (active && (settled?.query !== query || settled.functions !== functions));

  return useMemo(
    () => ({ extensionSearchSections, isFetchingExtensionSearch }),
    [extensionSearchSections, isFetchingExtensionSearch]
  );
}

type SearchFunctions = Array<PluginExtensionFunction<PluginExtensionCommandPaletteSearchProvider>>;

/**
 * Keeps the previous array while the providers are the same. The search effect restarts, and so aborts the
 * running providers, whenever this changes, so a new array with equal content on each render must not count.
 */
function useStableFunctions(latest: SearchFunctions): SearchFunctions {
  const [stable, setStable] = useState(latest);
  const isSame =
    latest.length === stable.length && latest.every((f, i) => f.id === stable[i].id && f.fn === stable[i].fn);
  if (!isSame) {
    setStable(latest);
  }
  return isSame ? stable : latest;
}
