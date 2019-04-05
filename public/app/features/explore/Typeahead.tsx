import React, { createRef } from 'react';
// @ts-ignore
import _ from 'lodash';
import { FixedSizeList } from 'react-window';
import { default as calculateSize } from 'calculate-size';
import { Themeable, GrafanaTheme, withTheme } from '@grafana/ui';

import { CompletionItem, CompletionItemGroup } from 'app/types/explore';
import { GROUP_TITLE_KIND, TypeaheadItem } from './TypeaheadItem';
import { TypeaheadInfo } from './TypeaheadInfo';

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
  listRef: any = createRef();
  documentationRef: any = createRef();

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
        this.refreshDocumentation();
        return;
      }
      const index = this.state.allItems.findIndex(item => item === this.props.selectedItem);
      this.listRef.current.scrollToItem(index);
      this.refreshDocumentation();
    }

    if (_.isEqual(prevProps.groupedItems, this.props.groupedItems) === false) {
      const allItems = this.flattenGroupItems(this.props);
      const longestLabel = this.calculateLongestLabel(allItems);
      const { listWidth, listHeight, itemHeight } = this.calculateListSizes(this.props.theme, allItems, longestLabel);
      this.setState({ listWidth, listHeight, itemHeight, allItems }, () => this.refreshDocumentation());
    }
  };

  refreshDocumentation = () => {
    if (!this.documentationRef.current) {
      return;
    }

    const index = this.state.allItems.findIndex(item => item === this.props.selectedItem);
    const item = this.state.allItems[index];

    if (item) {
      this.documentationRef.current.refresh(item);
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
    const numberOfItemsToShow = Math.min(allItems.length, 10);
    const minHeight = 100;
    const itemsInView = allItems.slice(0, numberOfItemsToShow);
    const totalHeight = itemsInView.length * itemHeight;
    const listHeight = Math.max(totalHeight, minHeight);

    return listHeight;
  };

  onMouseEnter = (item: CompletionItem) => {
    this.documentationRef.current.refresh(item);
  };

  onMouseLeave = () => {
    this.documentationRef.current.hide();
  };

  render() {
    const { menuRef, selectedItem, onClickItem, prefix, theme } = this.props;
    const { listWidth, listHeight, itemHeight, allItems } = this.state;

    return (
      <ul className="typeahead" ref={menuRef}>
        <TypeaheadInfo
          ref={this.documentationRef}
          width={listWidth}
          height={listHeight}
          theme={theme}
          initialItem={selectedItem}
        />
        <FixedSizeList
          ref={this.listRef}
          itemCount={allItems.length}
          itemSize={itemHeight}
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
                onMouseEnter={this.onMouseEnter}
                onMouseLeave={this.onMouseLeave}
              />
            );
          }}
        </FixedSizeList>
      </ul>
    );
  }
}

export const TypeaheadWithTheme = withTheme(Typeahead);
