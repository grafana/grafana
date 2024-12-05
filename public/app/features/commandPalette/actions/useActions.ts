import { useEffect, useMemo, useState } from 'react';

import { PreferencesService } from 'app/core/services/PreferencesService';
import { useSelector } from 'app/types';

import { CommandPaletteAction } from '../types';
import { commandPaletteActionHasSomethingToPerform } from '../utils';

import { getRecentDashboardActions } from './dashboardActions';
import getStaticActions from './staticActions';
import useExtensionActions from './useExtensionActions';

const userPreferencesService = new PreferencesService('user');
const RECENT_ACTIONS_LS_KEY = 'grafana.command-palette.recent-actions';
const RECENT_ACTIONS_LIMIT = 20;

export default function useActions(searchQuery: string) {
  const [staticActions, setStaticActions] = useState<CommandPaletteAction[]>([]);
  const [recentDashboardActions, setRecentDashboardActions] = useState<CommandPaletteAction[]>([]);
  const [userDefinedActions, setUserDefinedActions] = useState<CommandPaletteAction[]>([]);
  const [recentActions, setRecentActions] = useState<CommandPaletteAction[]>([]);
  const extensionActions = useExtensionActions();

  const navBarTree = useSelector((state) => state.navBarTree);

  const ingestRecentActionsFromAllActions = (allActions: CommandPaletteAction[]): void => {
    const recentActionIdsInLocalStorage = localStorage.getItem(RECENT_ACTIONS_LS_KEY);
    const jsonParsedRecentActions: string[] = recentActionIdsInLocalStorage
      ? JSON.parse(recentActionIdsInLocalStorage)
      : [];
    const newRecentActions = allActions.filter((action) => jsonParsedRecentActions.includes(action.id));

    setRecentActions(newRecentActions);
  };

  const allSearchableActions = useMemo(
    () => [...userDefinedActions, ...recentDashboardActions, ...staticActions],
    [staticActions, recentDashboardActions, userDefinedActions]
  );

  // Load standard static actions
  useEffect(() => {
    const staticActionsResp = getStaticActions(navBarTree, extensionActions);
    setStaticActions(staticActionsResp);
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

  // Load user defined actions
  useEffect(() => {
    (async () => {
      const { customCommands = [] } = await userPreferencesService.load();
      setUserDefinedActions(
        customCommands.map((command) => ({
          id: command.ID,
          name: command.title,
          url: command.path,
          parent: '',
          children: [],
          ancestors: [],
          priority: 1,
          shortcut: command.shortcut,
          section: 'Mine',
        }))
      );
    })();
  }, []);

  useEffect(() => {
    ingestRecentActionsFromAllActions(allSearchableActions);
  }, [allSearchableActions]);

  const setNewRecentAction = (id: string) => {
    const foundAction = allSearchableActions.find((action) => action.id === id);

    // if action not found or has nothing to do (means it's a parent action), ignore it
    if (!foundAction || !commandPaletteActionHasSomethingToPerform(foundAction)) {
      return;
    }

    const newRecentActions = [foundAction, ...recentActions.filter((action) => action.id !== id)];
    localStorage.setItem(RECENT_ACTIONS_LS_KEY, JSON.stringify(newRecentActions.map((action) => action.id)));
    setRecentActions(newRecentActions.slice(0, RECENT_ACTIONS_LIMIT));
  };

  return {
    allSearchableActions,
    userDefinedActions,
    recentActions,
    setNewRecentAction,
    extensionActions,
    staticActions,
  };
}
