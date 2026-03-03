import { Action, useKBar, useRegisterActions } from 'kbar';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useDebounce } from 'react-use';

import { CommandPaletteDynamicResult, PluginExtensionCommandPaletteContext } from '@grafana/data';
import { appEvents } from 'app/core/app_events';
import { CloseExtensionSidebarEvent, OpenExtensionSidebarEvent, ToggleExtensionSidebarEvent } from 'app/types/events';

import { createOpenModalFunction } from '../../plugins/extensions/utils';
import { commandPaletteDynamicRegistry, CommandPaletteDynamicSearchResult } from '../CommandPaletteDynamicRegistry';
import { CommandPaletteAction } from '../types';
import { EXTENSIONS_PRIORITY } from '../values';

interface DynamicResultWithPluginId extends CommandPaletteDynamicResult {
  pluginId: string;
}

function buildEventHelpers(result: DynamicResultWithPluginId, searchQuery: string) {
  const extensionPointId = 'grafana/commandpalette/action';
  return {
    context: { searchQuery, signal: new AbortController().signal },
    extensionPointId,
    openModal: createOpenModalFunction({
      pluginId: result.pluginId,
      title: result.title,
      description: result.description,
      extensionPointId,
      path: result.path,
      category: result.section,
    }),
    openSidebar: (componentTitle: string, context?: Record<string, unknown>) => {
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
    toggleSidebar: (componentTitle: string, context?: Record<string, unknown>) => {
      appEvents.publish(
        new ToggleExtensionSidebarEvent({
          props: context,
          pluginId: result.pluginId,
          componentTitle,
        })
      );
    },
  };
}

/**
 * Fetches dynamic results from plugin extensions.
 *
 * Flat results (no children) bypass kbar's store and are returned as
 * CommandPaletteAction[] for manual merging into search results.
 *
 * Hierarchical results (with children) are registered with kbar via
 * useRegisterActions so that the parent/child drill-down mechanism works.
 */
export function useDynamicExtensionResults(searchQuery: string): {
  results: CommandPaletteAction[];
  isLoading: boolean;
} {
  const [dynamicResults, setDynamicResults] = useState<DynamicResultWithPluginId[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const { currentRootActionId } = useKBar((state) => ({
    currentRootActionId: state.currentRootActionId,
  }));

  // When drilled into a dynamic parent, don't clear results even if search is empty
  const isDrilledIntoDynamic = Boolean(currentRootActionId?.startsWith('dynamic-'));

  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(searchQuery);

  useDebounce(
    () => {
      setDebouncedSearchQuery(searchQuery);
    },
    300,
    [searchQuery]
  );

  useEffect(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    if (debouncedSearchQuery.length < 2) {
      if (!isDrilledIntoDynamic) {
        setDynamicResults([]);
      }
      setIsLoading(false);
      return;
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setIsLoading(true);

    const context: PluginExtensionCommandPaletteContext = {
      searchQuery: debouncedSearchQuery,
      signal: abortController.signal,
    };

    commandPaletteDynamicRegistry
      .search(context)
      .then((resultsMap: Map<string, CommandPaletteDynamicSearchResult>) => {
        if (abortController.signal.aborted) {
          return;
        }

        const allResults: DynamicResultWithPluginId[] = [];

        resultsMap.forEach(({ items, config }: CommandPaletteDynamicSearchResult) => {
          items.forEach((item: CommandPaletteDynamicResult) => {
            allResults.push({
              ...item,
              pluginId: config.pluginId,
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

    return () => {
      abortController.abort();
    };
  }, [debouncedSearchQuery, isDrilledIntoDynamic]);

  // Register hierarchical results (with children) in kbar's store
  const hierarchicalActions: Action[] = useMemo(() => {
    const actions: Action[] = [];
    dynamicResults
      .filter((r) => r.children && r.children.length > 0)
      .forEach((result) => {
        const parentId = `dynamic-${result.pluginId}-${result.id}`;
        const section = result.section ?? 'Dynamic Results';

        const parentAction: Action & { detailPanel?: React.ReactNode } = {
          id: parentId,
          name: result.title,
          subtitle: result.description,
          section,
          icon: result.icon,
          priority: EXTENSIONS_PRIORITY - 0.5,
          keywords: result.keywords?.join(' '),
        };
        if (result.detailPanel) {
          parentAction.detailPanel = result.detailPanel;
        }
        actions.push(parentAction);

        result.children!.forEach((child) => {
          const childPerform = child.onSelect
            ? () => {
                child.onSelect!(child, buildEventHelpers(result, debouncedSearchQuery));
              }
            : undefined;

          actions.push({
            id: `${parentId}/${child.id}`,
            name: child.title,
            subtitle: child.description,
            parent: parentId,
            icon: child.icon,
            perform: childPerform,
            keywords: child.keywords?.join(' '),
          });
        });
      });
    return actions;
  }, [dynamicResults, debouncedSearchQuery]);

  useRegisterActions(hierarchicalActions, [hierarchicalActions]);

  // Convert flat results (no children) to CommandPaletteAction[]
  const results: CommandPaletteAction[] = useMemo(() => {
    return dynamicResults
      .filter((r) => !r.children || r.children.length === 0)
      .map((result) => {
        const section = result.section ?? 'Dynamic Results';

        const perform = result.onSelect
          ? () => {
              result.onSelect!(result, buildEventHelpers(result, debouncedSearchQuery));
            }
          : undefined;

        return {
          id: `dynamic-${result.pluginId}-${result.id}`,
          name: result.title,
          section,
          subtitle: result.description,
          priority: EXTENSIONS_PRIORITY - 0.5,
          keywords: result.keywords?.join(' '),
          perform,
          url: result.path,
          icon: result.icon,
          secondaryActions: result.secondaryActions,
          detailPanel: result.detailPanel,
        };
      });
  }, [dynamicResults, debouncedSearchQuery]);

  return { results, isLoading };
}
