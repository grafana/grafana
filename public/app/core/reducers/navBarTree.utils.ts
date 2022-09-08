import { NavModelItem } from '@grafana/data';

import { getActiveItem } from '../components/NavBar/utils';

export const traverseMenuTree = (items: NavModelItem[], onItem: (item: NavModelItem) => void) => {
  for (const item of items) {
    onItem(item);

    if (item.children) {
      traverseMenuTree(item.children, onItem);
    }
  }
};

export const updateExpandedState = (initial: NavModelItem[]): NavModelItem[] => {
  const parentMap: Record<string, NavModelItem> = {};

  traverseMenuTree(initial, (item) => {
    item.expanded = false;

    item.children?.map((child) => {
      parentMap[child.id || ''] = item;
    });
  });

  const activeItem = getActiveItem(initial, window.location.pathname);

  if (activeItem) {
    let current: NavModelItem | undefined = activeItem;

    if (current) {
      current.expanded = true;
    }

    while (current) {
      current = parentMap[current.id || ''];

      if (current) {
        current.expanded = true;
      }
    }
  }

  return initial;
};
