import React from 'react';
// @ts-ignore
import _ from 'lodash';
import { VariableSizeList } from 'react-window';
import { default as calculateSize } from 'calculate-size';
import { Themeable, GrafanaTheme, withTheme } from '@grafana/ui';

import { CompletionItem, CompletionItemGroup } from 'app/types/explore';
import { GROUP_TITLE_KIND, TypeaheadItem } from './TypeaheadItem';

interface Props extends Themeable {
  groupedItems: CompletionItemGroup[];
  menuRef: any;
  selectedItem: CompletionItem | null;
  onClickItem: (suggestion: CompletionItem) => void;
  prefix?: string;
  typeaheadIndex: number;
}

interface State {
  allItems: CompletionItem[];
  listWidth: number;
  listHeight: number;
  itemHeight: number;
}

export class Typeahead extends React.PureComponent<Props, State> {
  listRef: any = React.createRef();

  constructor(props: Props) {
    super(props);

    const allItems = this.flattenGroupItems(props);
    const longestLabel = this.calculateLongestLabel(allItems);
    const { listWidth, listHeight, itemHeight } = this.calculateListSizes(props.theme, allItems, longestLabel);
    this.state = { listWidth, listHeight, itemHeight, allItems };
  }

  componentDidUpdate = (prevProps: Readonly<Props>) => {
    if (prevProps.typeaheadIndex !== this.props.typeaheadIndex && this.listRef && this.listRef.current) {
      if (prevProps.typeaheadIndex === 1 && this.props.typeaheadIndex === 0) {
        this.listRef.current.scrollToItem(0); // special case for handling the first group label
        return;
      }
      const index = this.state.allItems.findIndex(item => item === this.props.selectedItem);
      this.listRef.current.scrollToItem(index);
    }

    if (_.isEqual(prevProps.groupedItems, this.props.groupedItems) === false) {
      const allItems = this.flattenGroupItems(this.props);
      const longestLabel = this.calculateLongestLabel(allItems);
      const { listWidth, listHeight, itemHeight } = this.calculateListSizes(this.props.theme, allItems, longestLabel);
      this.setState({ listWidth, listHeight, itemHeight, allItems });
    }
  };

  flattenGroupItems = (props: Props): CompletionItem[] => {
    return props.groupedItems.reduce((all, current) => {
      const titleItem: CompletionItem = {
        label: current.label,
        kind: GROUP_TITLE_KIND,
      };
      return all.concat(titleItem, current.items);
    }, []);
  };

  calculateLongestLabel = (allItems: CompletionItem[]): string => {
    return allItems.reduce((longest, current) => {
      return longest.length < current.label.length ? current.label : longest;
    }, '');
  };

  calculateListSizes = (theme: GrafanaTheme, allItems: CompletionItem[], longestLabel: string) => {
    const size = calculateSize(longestLabel, {
      font: theme.typography.fontFamily.monospace,
      fontSize: theme.typography.size.sm,
      fontWeight: 'normal',
    });

    const listWidth = this.calculateListWidth(size.width, theme);
    const itemHeight = this.calculateItemHeight(size.height, theme);
    const listHeight = this.calculateListHeight(itemHeight, listWidth, theme, allItems);

    return {
      listWidth,
      listHeight,
      itemHeight,
    };
  };

  calculateItemHeight = (longestLabelHeight: number, theme: GrafanaTheme) => {
    const horizontalPadding = parseInt(theme.spacing.sm, 10) * 2;
    const itemHeight = longestLabelHeight + horizontalPadding;

    return itemHeight;
  };

  calculateListWidth = (longestLabelWidth: number, theme: GrafanaTheme) => {
    const verticalPadding = parseInt(theme.spacing.sm, 10) + parseInt(theme.spacing.md, 10);
    const maxWidth = 800;
    const listWidth = Math.min(Math.max(longestLabelWidth + verticalPadding, 200), maxWidth);

    return listWidth;
  };

  calculateListHeight = (itemHeight: number, listWidth: number, theme: GrafanaTheme, allItems: CompletionItem[]) => {
    const numberOfItemsToShow = Math.min(allItems.length, 6);
    const minHeight = 100;
    const itemsInView = allItems.slice(0, numberOfItemsToShow);
    const totalHeight = itemsInView.reduce((total, current) => {
      if (current.documentation) {
        const documentationSize = calculateSize(current.documentation, {
          font: theme.typography.fontFamily.monospace,
          fontSize: theme.typography.size.sm,
          fontWeight: 'normal',
          width: `${listWidth}px`,
        });
        return (total += itemHeight + documentationSize.height);
      }
      return (total += itemHeight);
    }, 0);
    const listHeight = Math.max(totalHeight, minHeight);

    return listHeight;
  };

  render() {
    const { menuRef, selectedItem, onClickItem, prefix, typeaheadIndex, theme } = this.props;
    const { listWidth, listHeight, itemHeight, allItems } = this.state;

    if (this.listRef && this.listRef.current) {
      this.listRef.current.resetAfterIndex(typeaheadIndex, false); // forces react-window to call itemSize method below
    }

    return (
      <ul className="typeahead" ref={menuRef}>
        <VariableSizeList
          ref={this.listRef}
          itemCount={allItems.length}
          itemSize={index => {
            const item = allItems && allItems[index];
            if (!item) {
              return 0;
            }

            if (!item.documentation) {
              return itemHeight;
            }

            const documentationSize = calculateSize(item.documentation, {
              font: theme.typography.fontFamily.monospace,
              fontSize: theme.typography.size.sm,
              fontWeight: 'normal',
              width: `${listWidth}px`,
            });

            return itemHeight + documentationSize.height;
          }}
          itemKey={index => {
            const item = allItems && allItems[index];
            const key = item ? `${index}-${item.label}` : `${index}`;
            return key;
          }}
          width={listWidth}
          height={listHeight}
        >
          {({ index, style }) => {
            const item = allItems && allItems[index];
            if (!item) {
              return null;
            }

            return (
              <TypeaheadItem
                onClickItem={onClickItem}
                isSelected={selectedItem === item}
                item={item}
                prefix={prefix}
                style={style}
              />
            );
          }}
        </VariableSizeList>
      </ul>
    );
  }
}

export const TypeaheadWithTheme = withTheme(Typeahead);
