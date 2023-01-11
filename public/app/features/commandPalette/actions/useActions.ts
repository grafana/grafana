import { useEffect, useState } from 'react';

import { useSelector } from 'app/types';

import { CommandPaletteAction } from '../types';

import { getRecentDashboardActions } from './dashboardActions';
import getStaticActions from './staticActions';

export default function useActions() {
  const [staticActions, setStaticActions] = useState<CommandPaletteAction[]>([]);

  const { navBarTree } = useSelector((state) => {
    return {
      navBarTree: state.navBarTree,
    };
  });

  // Load standard static actions
  useEffect(() => {
    const staticActionsResp = getStaticActions(navBarTree);
    setStaticActions(staticActionsResp);
  }, [navBarTree]);

  // Load recent dashboards - we don't want them to reload when the nav tree changes
  useEffect(() => {
    getRecentDashboardActions()
      .then((recentDashboardActions) => setStaticActions((v) => [...v, ...recentDashboardActions]))
      .catch((err) => {
        console.error('Error loading recent dashboard actions', err);
      });
  }, []);

  return staticActions;
}
