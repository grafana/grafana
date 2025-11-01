import { useRegisterActions } from 'kbar';
import { useEffect, useMemo, useState } from 'react';

import { CommandPaletteAction } from '../types';

import { getRecentDashboardActions } from './dashboardActions';
import { useStaticActions } from './staticActions';
import { useDynamicExtensionActions } from './useDynamicExtensionActions';
import useExtensionActions from './useExtensionActions';

/**
 * Register navigation actions to different parts of grafana or some preferences stuff like themes.
 */
export function useRegisterStaticActions() {
  const extensionActions = useExtensionActions();
  const staticActions = useStaticActions();

  const navTreeActions = useMemo(() => {
    return [...staticActions, ...extensionActions];
  }, [staticActions, extensionActions]);

  useRegisterActions(navTreeActions, [navTreeActions]);
}

export function useRegisterRecentDashboardsActions() {
  const [recentDashboardActions, setRecentDashboardActions] = useState<CommandPaletteAction[]>([]);
  useEffect(() => {
    getRecentDashboardActions()
      .then((recentDashboardActions) => setRecentDashboardActions(recentDashboardActions))
      .catch((err) => {
        console.error('Error loading recent dashboard actions', err);
      });
  }, []);

  useRegisterActions(recentDashboardActions, [recentDashboardActions]);
}

/**
 * Register dynamic actions based on search query
 * These are fetched from plugins that registered dynamic search providers
 */
export function useRegisterDynamicActions(searchQuery: string) {
  const { actions: dynamicActions, isLoading } = useDynamicExtensionActions(searchQuery);

  useRegisterActions(dynamicActions, [dynamicActions]);

  return { isLoading };
}
