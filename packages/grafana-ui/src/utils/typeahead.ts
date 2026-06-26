import { default as calculateSize } from 'calculate-size';

import { GrafanaTheme2 } from '@grafana/data';

import { CompletionItemGroup, CompletionItem, CompletionItemKind } from '../types/completion';

export const flattenGroupItems = (groupedItems: CompletionItemGroup[]): CompletionItem[] => {
  return groupedItems.reduce((all: CompletionItem[], { items, label }) => {
    all.push({
      label,
      kind: CompletionItemKind.GroupTitle,
    });
    return items.reduce((all, item) => {
      all.push(item);
      return all;
    }, all);
  }, []);
};

export const calculateLongestLabel = (allItems: CompletionItem[]): string => {
  return allItems.reduce((longest, current) => {
    return longest.length < current.label.length ? current.label : longest;
  }, '');
};

export const calculateListSizes = (theme: GrafanaTheme2, allItems: CompletionItem[], longestLabel: string) => {
  const size = calculateSize(longestLabel, {
    font: theme.typography.fontFamilyMonospace,
    fontSize: theme.typography.bodySmall.fontSize,
    fontWeight: 'normal',
  });

  const listWidth = calculateListWidth(size.width, theme);
  const itemHeight = calculateItemHeight(size.height, theme);
  const listHeight = calculateListHeight(itemHeight, allItems);

  return {
    listWidth,
    listHeight,
    itemHeight,
  };
};

export const calculateItemHeight = (longestLabelHeight: number, theme: GrafanaTheme2) => {
  const horizontalPadding = theme.spacing.gridSize * 2;
  const itemHeight = longestLabelHeight + horizontalPadding;

  return itemHeight;
};

export const calculateListWidth = (longestLabelWidth: number, theme: GrafanaTheme2) => {
  const verticalPadding = theme.spacing.gridSize * 3;
  const maxWidth = 800;
  const listWidth = Math.min(Math.max(longestLabelWidth + verticalPadding, 200), maxWidth);

  return listWidth;
};

export const calculateListHeight = (itemHeight: number, allItems: CompletionItem[]) => {
  const numberOfItemsToShow = Math.min(allItems.length, 10);
  const minHeight = 100;
  const totalHeight = numberOfItemsToShow * itemHeight;
  const listHeight = Math.max(totalHeight, minHeight);

  return listHeight;
};
