import { useEffect, useMemo, useRef, useState } from 'react';
import { useDebounce } from 'react-use';

import {
  CommandPaletteDynamicResult,
  CommandPaletteDynamicResultAction,
  PluginExtensionCommandPaletteContext,
} from '@grafana/data';
import appEvents from 'app/core/app_events';
import { CloseExtensionSidebarEvent, OpenExtensionSidebarEvent, ToggleExtensionSidebarEvent } from 'app/types/events';

import { commandPaletteDynamicRegistry } from '../../plugins/extensions/registry/setup';
import { createOpenModalFunction } from '../../plugins/extensions/utils';
import { CommandPaletteAction } from '../types';
import { EXTENSIONS_PRIORITY } from '../values';

interface DynamicResultWithAction extends CommandPaletteDynamicResult {
  pluginId: string;
  onSelect?: CommandPaletteDynamicResultAction;
}

export function useDynamicExtensionActions(searchQuery: string): {
  actions: CommandPaletteAction[];
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
      .then((resultsMap) => {
        if (abortController.signal.aborted) {
          return;
        }

        const allResults: DynamicResultWithAction[] = [];

        resultsMap.forEach(({ items, config }) => {
          items.forEach((item) => {
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
      .catch((error) => {
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

  const actions: CommandPaletteAction[] = useMemo(() => {
    return dynamicResults.map((result) => ({
      id: `dynamic-${result.pluginId}-${result.id}`,
      name: result.title,
      section: result.section ?? 'Dynamic Results',
      subtitle: result.description,
      priority: EXTENSIONS_PRIORITY - 0.5, // Slightly lower than static extensions
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
    }));
  }, [dynamicResults, debouncedSearchQuery]);

  return { actions, isLoading };
}
