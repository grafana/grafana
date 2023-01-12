import debounce from 'debounce-promise';
import { useEffect, useMemo, useState } from 'react';

import { useSelector } from 'app/types';

import { CommandPaletteAction } from '../types';

import { getDashboardSearchResultActions, getRecentDashboardActions } from './dashboardActions';
import getStaticActions from './staticActions';

const debouncedDashboardSearch = debounce(getDashboardSearchResultActions, 200);

export default function useActions(searchQuery: string, isShowing: boolean) {
  const [staticActions, setStaticActions] = useState<CommandPaletteAction[]>([]);
  const [dashboardResultActions, setDashboardResultActions] = useState<CommandPaletteAction[]>([]);

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

  // Hit dashboards API
  useEffect(() => {
    if (isShowing && searchQuery.length > 0) {
      debouncedDashboardSearch(searchQuery).then((resultActions) => {
        setDashboardResultActions(resultActions);
      });
    }
  }, [isShowing, searchQuery]);

  const actions = useMemo(() => [...staticActions, ...dashboardResultActions], [staticActions, dashboardResultActions]);

  return actions;
}
