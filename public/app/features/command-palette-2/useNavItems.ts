import { useMemo } from 'react';

import { useSelector } from 'app/types/store';

import { navTreeToActions } from '../commandPalette/actions/staticActions';

import { CommandPaletteItem } from './types';

export function useNavItems(): CommandPaletteItem[] {
  const navBarTree = useSelector((state) => state.navBarTree);

  const navItems: CommandPaletteItem[] = useMemo(() => {
    const oldNavActions = navTreeToActions(navBarTree);

    return oldNavActions.map((navItem) => {
      const items: CommandPaletteItem = {
        type: 'result',
        title: navItem.name,
        icon: 'corner-down-right-alt',
        parentTitle: typeof navItem.url === 'string' ? navItem.url : undefined,
      };

      return items;
    });
  }, [navBarTree]);

  return navItems;
}
