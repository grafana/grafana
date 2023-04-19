import { DashboardsTreeItem, DashboardTreeSelection } from './types';

type ItemSelectionState = 'unselected' | 'selected' | 'mixed';

export function itemIsSelected(
  items: DashboardsTreeItem[],
  selectedItems: DashboardTreeSelection,
  row: DashboardsTreeItem
): ItemSelectionState {
  const { item } = row;
  if (item.kind === 'ui-empty-folder') {
    return 'unselected';
  }

  let isSelected = selectedItems?.[item.kind][item.uid] ?? false;
  let lastRow = row;

  while (!isSelected) {
    const lastRowItem = lastRow.item;

    const parent = items.find(({ item: childItem }) => {
      if (childItem.kind === 'ui-empty-folder' || lastRowItem.kind === 'ui-empty-folder') {
        return false;
      }

      return childItem.uid === lastRowItem.parentUID;
    });

    if (!parent) {
      break;
    }

    isSelected = itemIsSelected(items, selectedItems, parent) === 'selected';
    lastRow = parent;
  }

  // if (isSelected) {
  //   return true;
  // }

  return isSelected ? 'selected' : 'unselected';
}
