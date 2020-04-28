import { default as calculateSize } from 'calculate-size';
import { CompletionItemGroup, CompletionItem, CompletionItemKind } from '../types/completion';
import { GrafanaTheme } from '@grafana/data';

export const flattenGroupItems = (groupedItems: CompletionItemGroup[]): CompletionItem[] => {
  return groupedItems.reduce((all: CompletionItem[], { items, label }) => {
    const titleItem: CompletionItem = {
      label,
      kind: CompletionItemKind.GroupTitle,
    };
    all.push(titleItem, ...items);
    return all;
  }, []);
};

export const calculateLongestLabel = (allItems: CompletionItem[]): string => {
  return allItems.reduce((longest, current) => {
    return longest.length < current.label.length ? current.label : longest;
  }, '');
};

export const calculateListSizes = (theme: GrafanaTheme, allItems: CompletionItem[], longestLabel: string) => {
  const size = calculateSize(longestLabel, {
    font: theme.typography.fontFamily.monospace,
    fontSize: theme.typography.size.sm,
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

export const calculateItemHeight = (longestLabelHeight: number, theme: GrafanaTheme) => {
  const horizontalPadding = parseInt(theme.spacing.sm, 10) * 2;
  const itemHeight = longestLabelHeight + horizontalPadding;

  return itemHeight;
};

export const calculateListWidth = (longestLabelWidth: number, theme: GrafanaTheme) => {
  const verticalPadding = parseInt(theme.spacing.sm, 10) + parseInt(theme.spacing.md, 10);
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
