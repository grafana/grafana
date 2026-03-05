import { createElement, useEffect, useMemo, useState } from 'react';

import { CommandPaletteContextActionConfig } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { Icon, type IconName } from '@grafana/ui';

import { commandPaletteContextActionRegistry, CommandPaletteContextActionRegistryItem } from '../CommandPaletteContextActionRegistry';
import { CommandPaletteAction } from '../types';
import { ACTIONS_PRIORITY } from '../values';

const CONTEXT_ACTION_PREFIX = 'context-action-';

export interface ContextActionEntry {
  action: CommandPaletteAction;
  config: CommandPaletteContextActionConfig;
  hasSteps: boolean;
}

export function useContextActions(): ContextActionEntry[] {
  const [availableItems, setAvailableItems] = useState<CommandPaletteContextActionRegistryItem[]>([]);
  const location = locationService.getLocation();

  useEffect(() => {
    let cancelled = false;
    commandPaletteContextActionRegistry
      .getAvailableActions(location.pathname, location.search)
      .then((items) => {
        if (!cancelled) {
          setAvailableItems(items);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [location.pathname, location.search]);

  return useMemo(() => {
    return availableItems.map((item, index) => {
      const { config } = item;
      const hasSteps = Boolean(config.steps);

      const action: CommandPaletteAction = {
        id: `${CONTEXT_ACTION_PREFIX}${config.id}`,
        name: config.title,
        section: config.section ?? 'Pages',
        priority: ACTIONS_PRIORITY + availableItems.length - index,
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        icon: config.icon ? createElement(Icon, { name: config.icon as IconName }) : undefined,
        perform: hasSteps
          ? undefined
          : () => config.perform?.({ pathname: location.pathname, search: location.search }),
      };

      return { action, config, hasSteps };
    });
  }, [availableItems, location.pathname, location.search]);
}

export function isContextActionId(id: string): boolean {
  return id.startsWith(CONTEXT_ACTION_PREFIX);
}
