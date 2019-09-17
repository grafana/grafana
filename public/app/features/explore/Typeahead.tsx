import React, { createRef } from 'react';
import _ from 'lodash';
import { FixedSizeList } from 'react-window';

import { Themeable, withTheme } from '@grafana/ui';

import { CompletionItem, CompletionItemGroup } from 'app/types/explore';
import { TypeaheadItem } from './TypeaheadItem';
import { TypeaheadInfo } from './TypeaheadInfo';
import { flattenGroupItems, calculateLongestLabel, calculateListSizes } from './utils/typeahead';

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

    const allItems = flattenGroupItems(props.groupedItems);
    const longestLabel = calculateLongestLabel(allItems);
    const { listWidth, listHeight, itemHeight } = calculateListSizes(props.theme, allItems, longestLabel);
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
      const allItems = flattenGroupItems(this.props.groupedItems);
      const longestLabel = calculateLongestLabel(allItems);
      const { listWidth, listHeight, itemHeight } = calculateListSizes(this.props.theme, allItems, longestLabel);
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
