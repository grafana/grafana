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
    if (searchQuery.toLowerCase().includes('hackathon?')) {
      staticActionsResp.push({
        id: `x`,
        name: `Grafana X`,
        subtitle: ` - pushing Grafana to it's eXtreme`,
        keywords: searchQuery,
        section: `Introducing....`,
        url: `x`,
        parent: undefined,
        priority: 1,
      });
    } else if (searchQuery.toLowerCase().startsWith('w') || searchQuery.toLowerCase().startsWith('hmm')) {
    } else if (searchQuery) {
      staticActionsResp.push({
        id: `search-x-${searchQuery}`,
        name: `${searchQuery} - Ask Grafana X`,
        keywords: searchQuery,
        section: 'Search',
        url: `x/${searchQuery}`,
        parent: undefined,
        priority: 5,
      });
    }

    setNavTreeActions(staticActionsResp);
  }, [navBarTree, searchQuery]);

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

  return searchQuery ? navTreeActions : [...recentDashboardActions, ...navTreeActions];
}
