import { useEffect, useState } from 'react';

import { useSelector } from 'app/types';

import { CommandPaletteAction } from '../types';

import { getRecentDashboardActions } from './dashboardActions';
import { getRecentScopesActions } from './recentScopesActions';
import getStaticActions from './staticActions';
import useExtensionActions from './useExtensionActions';

export default function useActions(searchQuery: string) {
  const [navTreeActions, setNavTreeActions] = useState<CommandPaletteAction[]>([]);
  const [recentDashboardActions, setRecentDashboardActions] = useState<CommandPaletteAction[]>([]);
  const extensionActions = useExtensionActions();

  const navBarTree = useSelector((state) => state.navBarTree);
  const recentScopesActions = getRecentScopesActions();

  // Load standard static actions
  useEffect(() => {
    const staticActionsResp = getStaticActions(navBarTree, extensionActions);
    setNavTreeActions(staticActionsResp);
  }, [navBarTree, extensionActions]);

  // Load recent dashboards - we don't want them to reload when the nav tree changes
  useEffect(() => {
    if (!searchQuery) {
      getRecentDashboardActions()
        .then((recentDashboardActions) => setRecentDashboardActions(recentDashboardActions))
        .catch((err) => {
          console.error('Error loading recent dashboard actions', err);
        });
    }
  }, [searchQuery]);

  return searchQuery ? navTreeActions : [...recentDashboardActions, ...navTreeActions, ...recentScopesActions];
}
