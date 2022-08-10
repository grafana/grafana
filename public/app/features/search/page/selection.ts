// Using '*' for uid will return true if anything is selected
export type SelectionChecker = (kind: string, uid: string) => boolean;
export type SelectionToggle = (kind: string, uid: string) => void;

export interface SearchSelection {
  // Check if an item is selected
  isSelected: SelectionChecker;

  // Selected items by kind
  items: Map<string, Set<string>>;
}

export function newSearchSelection(): SearchSelection {
  // the check is called often, on potentially large (all) results so using Map/Set is better than simple array
  const items = new Map<string, Set<string>>();

  const isSelected = (kind: string, uid: string) => {
    return Boolean(items.get(kind)?.has(uid));
  };

  return {
    items,
    isSelected,
  };
}

export function updateSearchSelection(
  old: SearchSelection,
  selected: boolean,
  kind: string,
  uids: string[]
): SearchSelection {
  const items = old.items; // mutate! :/

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
    items,
    isSelected: (kind: string, uid: string) => {
      if (uid === '*') {
        if (kind === '*') {
          for (const k of items.keys()) {
            if (items.get(k)?.size) {
              return true;
            }
          }
          return false;
        }
        return Boolean(items.get(kind)?.size);
      }
      return Boolean(items.get(kind)?.has(uid));
    },
  };
}
