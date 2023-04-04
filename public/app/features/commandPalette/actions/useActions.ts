import { useEffect, useState } from 'react';

import { useSelector } from 'app/types';

import { CommandPaletteAction } from '../types';

import { getRecentDashboardActions } from './dashboardActions';
import getStaticActions from './staticActions';

export default function useActions(searchQuery: string) {
  const [navTreeActions, setNavTreeActions] = useState<CommandPaletteAction[]>([]);
  const [recentDashboardActions, setRecentDashboardActions] = useState<CommandPaletteAction[]>([]);

  const { navBarTree } = useSelector((state) => {
    return {
      navBarTree: state.navBarTree,
    };
  });
  // Load standard static actions
  useEffect(() => {
    const staticActionsResp = getStaticActions(navBarTree);
    setNavTreeActions(staticActionsResp);
  }, [navBarTree]);

  // Load recent dashboards - we don't want them to reload when the nav tree changes
  useEffect(() => {
    if (!searchQuery) {
      getRecentDashboardActions()
        .then((recentDashboardActions) => setRecentDashboardActions(recentDashboardActions))
        .catch((err) => {
          console.error('Error loading recent dashboard actions', err);
        });
    } else {
      setRecentDashboardActions([]);
    }
  }, [searchQuery]);

  return [...recentDashboardActions, ...navTreeActions];
}
