import React from 'react';
// @ts-ignore
import _ from 'lodash';
import { default as calculateSize } from 'calculate-size';
import { FixedSizeList } from 'react-window';
import { Themeable, withTheme } from '@grafana/ui';

import { CompletionItem } from 'app/types/explore';
import { TypeaheadItem } from './TypeaheadItem';

interface Props extends Themeable {
  items: CompletionItem[];
  label: string;
  onClickItem: (suggestion: CompletionItem) => void;
  selected: CompletionItem;
  prefix?: string;
  scrollIndex: number;
}

interface State {
  listWidth: number;
  listHeight: number;
  itemSize: number;
}

export class TypeaheadGroup extends React.PureComponent<Props, State> {
  listRef: any = React.createRef();

  constructor(props: Props) {
    super(props);

    const { listWidth, listHeight, itemSize } = this.calculateListSizes(props);
    this.state = { listWidth, listHeight, itemSize };
  }

  componentDidUpdate(prevProps: Props) {
    const { scrollIndex, items } = this.props;

    if (prevProps.scrollIndex !== scrollIndex) {
      if (this.listRef && this.listRef.current) {
        this.listRef.current.scrollToItem(scrollIndex);
      }
    }

    if (_.isEqual(items, prevProps.items) === false) {
      const { listWidth, listHeight, itemSize } = this.calculateListSizes(this.props);
      this.setState({ listWidth, listHeight, itemSize });
    }
  }

  calculateListSizes = (props: Props): State => {
    const { items, theme, label } = props;

    const hasDocumentation = items.some(item => !!item.documentation);

    const longestLabel = items.reduce((longest, current) => {
      return longest.length < current.label.length ? current.label : longest;
    }, label);

    const size = calculateSize(longestLabel, {
      font: props.theme.typography.fontFamily.monospace,
      fontSize: props.theme.typography.size.sm,
    });

    const verticalPadding = parseInt(theme.spacing.sm, 10) + parseInt(theme.spacing.md, 10);
    const horizontalPadding = parseInt(theme.spacing.sm, 10) * 2;
    const documentationSize = hasDocumentation ? 15 : 0;
    const numberOfItemsToShow = Math.min(items.length, 10);
    const itemSize = size.height + horizontalPadding + documentationSize;
    const listWidth = Math.min(Math.max(size.width + verticalPadding, 200), 800);
    const listHeight = Math.max(itemSize * numberOfItemsToShow, 100);

    return {
      listWidth,
      listHeight,
      itemSize,
    };
  };

  render() {
    const { items, label, selected, onClickItem, prefix } = this.props;
    const { listWidth, listHeight, itemSize } = this.state;

    return (
      <li className="typeahead-group">
        <div className="typeahead-group__title">
          <span>{label}</span>
        </div>
        <ul className="typeahead-group__list">
          <FixedSizeList
            ref={this.listRef}
            itemCount={items.length}
            itemSize={itemSize}
            itemKey={index => {
              const item = items && items[index];
              return item ? item.label : null;
            }}
            width={listWidth}
            height={listHeight}
          >
            {({ index, style }) => {
              const item = items && items[index];
              if (!item) {
                return null;
              }

              return (
                <TypeaheadItem
                  onClickItem={onClickItem}
                  isSelected={selected === item}
                  item={item}
                  prefix={prefix}
                  style={style}
                />
              );
            }}
          </FixedSizeList>
        </ul>
      </li>
    );
  }
}

export const TypeaheadGroupWithTheme = withTheme(TypeaheadGroup);
