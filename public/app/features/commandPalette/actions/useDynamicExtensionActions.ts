import { ActionImpl } from 'kbar';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useDebounce } from 'react-use';

import {
  CommandPaletteDynamicResult,
  CommandPaletteDynamicResultAction,
  PluginExtensionCommandPaletteContext,
} from '@grafana/data';
import { appEvents } from 'app/core/app_events';
import { CloseExtensionSidebarEvent, OpenExtensionSidebarEvent, ToggleExtensionSidebarEvent } from 'app/types/events';

import { createOpenModalFunction } from '../../plugins/extensions/utils';
import { commandPaletteDynamicRegistry, CommandPaletteDynamicSearchResult } from '../CommandPaletteDynamicRegistry';
import { CommandPaletteAction } from '../types';
import { EXTENSIONS_PRIORITY } from '../values';

interface DynamicResultWithAction extends CommandPaletteDynamicResult {
  pluginId: string;
  onSelect?: CommandPaletteDynamicResultAction;
}

export interface DynamicExtensionResultGroup {
  section: string;
  items: ActionImpl[];
}

/**
 * Fetches dynamic results from plugin extensions without registering them with kbar.
 * This allows the results to bypass kbar's fuzzy filtering since they're already
 * filtered by the plugin's searchProvider function.
 */
export function useDynamicExtensionResults(searchQuery: string): {
  results: DynamicExtensionResultGroup[];
  isLoading: boolean;
} {
  const [dynamicResults, setDynamicResults] = useState<DynamicResultWithAction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Debounce the search query
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(searchQuery);

  useDebounce(
    () => {
      setDebouncedSearchQuery(searchQuery);
    },
    300,
    [searchQuery]
  );

  useEffect(() => {
    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Clear results if query is too short
    if (debouncedSearchQuery.length < 2) {
      setDynamicResults([]);
      setIsLoading(false);
      return;
    }

    // Create new abort controller
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setIsLoading(true);

    const context: PluginExtensionCommandPaletteContext = {
      searchQuery: debouncedSearchQuery,
      signal: abortController.signal,
    };

    // Execute search across all registered providers
    commandPaletteDynamicRegistry
      .search(context)
      .then((resultsMap: Map<string, CommandPaletteDynamicSearchResult>) => {
        if (abortController.signal.aborted) {
          return;
        }

        const allResults: DynamicResultWithAction[] = [];

        resultsMap.forEach(({ items, config }: CommandPaletteDynamicSearchResult) => {
          items.forEach((item: CommandPaletteDynamicResult) => {
            allResults.push({
              ...item,
              pluginId: config.pluginId,
              onSelect: config.config.onSelect,
              section: item.section ?? config.config.category,
            });
          });
        });

        setDynamicResults(allResults);
        setIsLoading(false);
      })
      .catch((error: unknown) => {
        if (!abortController.signal.aborted) {
          console.error('[CommandPalette] Dynamic search failed:', error);
          setDynamicResults([]);
          setIsLoading(false);
        }
      });

    // Cleanup
    return () => {
      abortController.abort();
    };
  }, [debouncedSearchQuery]);

  // Group results by section and convert to ActionImpl objects
  const results: DynamicExtensionResultGroup[] = useMemo(() => {
    const groups = new Map<string, CommandPaletteAction[]>();

    dynamicResults.forEach((result) => {
      const section = result.section ?? 'Dynamic Results';
      
      if (!groups.has(section)) {
        groups.set(section, []);
      }

      const action: CommandPaletteAction = {
        id: `dynamic-${result.pluginId}-${result.id}`,
        name: result.title,
        section,
        subtitle: result.description,
        priority: EXTENSIONS_PRIORITY - 0.5,
        keywords: result.keywords?.join(' '),
        perform: () => {
          if (result.onSelect) {
            const extensionPointId = 'grafana/commandpalette/action';
            result.onSelect(result, {
              context: { searchQuery: debouncedSearchQuery },
              extensionPointId,
              openModal: createOpenModalFunction({
                pluginId: result.pluginId,
                title: result.title,
                description: result.description,
                extensionPointId,
                path: result.path,
                category: result.section,
              }),
              openSidebar: (componentTitle, context) => {
                appEvents.publish(
                  new OpenExtensionSidebarEvent({
                    props: context,
                    pluginId: result.pluginId,
                    componentTitle,
                  })
                );
              },
              closeSidebar: () => {
                appEvents.publish(new CloseExtensionSidebarEvent());
              },
              toggleSidebar: (componentTitle, context) => {
                appEvents.publish(
                  new ToggleExtensionSidebarEvent({
                    props: context,
                    pluginId: result.pluginId,
                    componentTitle,
                  })
                );
              },
            });
          }
        },
        url: result.path,
      };

      groups.get(section)!.push(action);
    });

    // Convert to array of groups with ActionImpl objects
    return Array.from(groups.entries()).map(([section, actions]) => ({
      section,
      items: actions.map((action) => new ActionImpl(action, { store: {} })),
    }));
  }, [dynamicResults, debouncedSearchQuery]);

  return { results, isLoading };
}
