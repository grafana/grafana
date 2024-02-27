import { useEffect, useMemo, useState } from 'react';

import { PluginExtensionPoints } from '@grafana/data';
import { usePluginLinkExtensions } from '@grafana/runtime';
import { useSelector } from 'app/types';

import { CommandPaletteAction } from '../types';
import { EXTENSIONS_PRIORITY } from '../values';

import { getRecentDashboardActions } from './dashboardActions';
import getStaticActions from './staticActions';

export default function useActions(searchQuery: string) {
  const [navTreeActions, setNavTreeActions] = useState<CommandPaletteAction[]>([]);
  const [recentDashboardActions, setRecentDashboardActions] = useState<CommandPaletteAction[]>([]);
  const { extensions } = usePluginLinkExtensions({
    extensionPointId: PluginExtensionPoints.CommandPalette,
    context: {},
    limitPerPlugin: 3,
  });
  const extensionActions = useMemo(() => {
    return extensions.map((extension) => ({
      section: extension.category ?? 'Extensions',
      priority: EXTENSIONS_PRIORITY,
      id: extension.id,
      name: extension.title,
      target: extension.path,
      perform: () => extension.onClick && extension.onClick(),
    }));
  }, [extensions]);

  const navBarTree = useSelector((state) => state.navBarTree);

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
    }
  }, [searchQuery]);

  return searchQuery ? navTreeActions : [...recentDashboardActions, ...navTreeActions, ...extensionActions];
}
