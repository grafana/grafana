import { DataFrameView } from '@grafana/data';

export type Item = { level: number; value: number; label: string; self: number };
export type ItemWithStart = Item & { start: number };

/**
 * Convert data frame with nested set format into array of level. This is mainly done for compatibility with current
 * rendering code.
 * @param dataView
 */
export function nestedSetToLevels(dataView: DataFrameView<Item>): ItemWithStart[][] {
  const levels: ItemWithStart[][] = [];
  let offset = 0;

  for (let i = 0; i < dataView.length; i++) {
    // We have to clone the items as .get(i) returns a changing pointer not the data themselves.
    const item = { ...dataView.get(i) };
    const prevItem = i > 0 ? { ...dataView.get(i - 1) } : undefined;

    levels[item.level] = levels[item.level] || [];
    if (prevItem && prevItem.level >= item.level) {
      // We are going down a level or staying at the same level so we are adding a sibling to the last item in a level.
      // So we have to compute the correct offset based on the last sibling.
      const lastItem = levels[item.level][levels[item.level].length - 1];
      offset = lastItem.start + lastItem.value;
    }
    const newItem: ItemWithStart = {
      ...item,
      start: offset,
    };

    levels[item.level].push(newItem);
  }
  return levels;
}
