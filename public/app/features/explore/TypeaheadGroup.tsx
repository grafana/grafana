import React from 'react';
// @ts-ignore
import _ from 'lodash';
import { default as calculateSize } from 'calculate-size';

import { CompletionItem } from 'app/types/explore';
import { FixedSizeList } from 'react-window';
import { TypeaheadItem } from './TypeaheadItem';

interface Props {
  items: CompletionItem[];
  label: string;
  onClickItem: (suggestion: CompletionItem) => void;
  selected: CompletionItem;
  prefix?: string;
  scrollIndex: number;
}

interface State {
  longestLabelWidth: number;
}

export class TypeaheadGroup extends React.PureComponent<Props, State> {
  listRef: any = React.createRef();

  constructor(props: Props) {
    super(props);
    const longestLabel = props.items.reduce((longest, current) => {
      return longest.length < current.label.length ? current.label : longest;
    }, '');
    const size = calculateSize(longestLabel, {
      font: 'Menlo, Monaco, Consolas, "Courier New", monospace',
      fontSize: '12px',
    });
    this.state = { longestLabelWidth: Math.max(size.width + 24, 100) };
  }

  componentDidUpdate(prevProps: Props) {
    const { scrollIndex } = this.props;

    if (prevProps.scrollIndex !== scrollIndex) {
      if (this.listRef && this.listRef.current) {
        this.listRef.current.scrollToItem(scrollIndex);
      }
    }
  }

  render() {
    const { items, label, selected, onClickItem, prefix } = this.props;
    const { longestLabelWidth } = this.state;

    return (
      <li className="typeahead-group">
        <div className="typeahead-group__title">{label}</div>
        <ul className="typeahead-group__list">
          <FixedSizeList
            ref={this.listRef}
            itemCount={items.length}
            itemSize={30}
            itemKey={index => {
              const item = items && items[index];
              return item ? item.label : null;
            }}
            width={longestLabelWidth}
            height={300}
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
