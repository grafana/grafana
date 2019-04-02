import React from 'react';
import Highlighter from 'react-highlight-words';

import { CompletionItem, CompletionItemGroup } from 'app/types/explore';
import { FixedSizeList } from 'react-window';

interface TypeaheadItemProps {
  isSelected: boolean;
  item: CompletionItem;
  onClickItem: (suggestion: CompletionItem) => void;
  prefix?: string;
  style: any;
}

class TypeaheadItem extends React.PureComponent<TypeaheadItemProps> {
  onClick = () => {
    this.props.onClickItem(this.props.item);
  };

  render() {
    const { isSelected, item, prefix, style } = this.props;
    const className = isSelected ? 'typeahead-item typeahead-item__selected' : 'typeahead-item';
    const label = item.label || '';
    return (
      <li className={className} onClick={this.onClick} style={style}>
        <Highlighter textToHighlight={label} searchWords={[prefix]} highlightClassName="typeahead-match" />
        {item.documentation && isSelected ? <div className="typeahead-item-hint">{item.documentation}</div> : null}
      </li>
    );
  }
}

interface TypeaheadGroupProps {
  items: CompletionItem[];
  label: string;
  onClickItem: (suggestion: CompletionItem) => void;
  selected: CompletionItem;
  prefix?: string;
  scrollIndex: number;
}

class TypeaheadGroup extends React.PureComponent<TypeaheadGroupProps> {
  listRef: any = React.createRef();

  componentDidUpdate(prevProps: TypeaheadGroupProps) {
    const { scrollIndex } = this.props;
    if (prevProps.scrollIndex !== scrollIndex) {
      if (this.listRef && this.listRef.current) {
        this.listRef.current.scrollToItem(scrollIndex);
      }
    }
  }

  render() {
    const { items, label, selected, onClickItem, prefix } = this.props;

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
            width={300}
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

interface TypeaheadProps {
  groupedItems: CompletionItemGroup[];
  menuRef: any;
  selectedItem: CompletionItem | null;
  onClickItem: (suggestion: CompletionItem) => void;
  prefix?: string;
  scrollIndex: number;
}
class Typeahead extends React.PureComponent<TypeaheadProps> {
  render() {
    const { groupedItems, menuRef, selectedItem, onClickItem, prefix, scrollIndex } = this.props;
    return (
      <ul className="typeahead" ref={menuRef}>
        {groupedItems.map((g, index) => (
          <TypeaheadGroup
            key={`${index}-${g.label}`}
            onClickItem={onClickItem}
            prefix={prefix}
            selected={selectedItem}
            scrollIndex={scrollIndex}
            {...g}
          />
        ))}
      </ul>
    );
  }
}

export default Typeahead;
