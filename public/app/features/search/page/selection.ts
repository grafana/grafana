export interface SearchSelection {
  // Check if an item is selected
  isSelected: (kind: string, uid: string) => boolean;

  // Will return a new instance with an updated object (will trigger a react state change!)
  update: (selected: boolean, kind: string, uids: string[]) => SearchSelection;

  // Selected items by kind
  items: Map<string, Set<string>>;
}

export function newSearchSelection(): SearchSelection {
  // the check is called often, on potentially large (all) results so using Map/Set is better than simple array
  const items = new Map<string, Set<string>>();

  const isSelected = (kind: string, uid: string) => {
    return Boolean(items.get(kind)?.has(uid));
  };

  const update = (selected: boolean, kind: string, uids: string[]) => {
    if (uids.length) {
      const k = items.get(kind);
      if (k) {
        for (const uid of uids) {
          if (selected) {
            k.add(uid);
          } else {
            k.delete(uid);
          }
        }
        if (k.size < 1) {
          items.delete(kind);
        }
      } else if (selected) {
        items.set(kind, new Set<string>(uids));
      }
    }

    return {
      isSelected,
      update,
      items,
    };
  };

  return {
    isSelected,
    update,
    items,
  };
}
