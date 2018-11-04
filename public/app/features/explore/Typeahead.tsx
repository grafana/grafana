import React from 'react';
import Highlighter from 'react-highlight-words';

import { CompletionItem, CompletionItemGroup } from 'app/types/explore';

function scrollIntoView(el: HTMLElement) {
  if (!el || !el.offsetParent) {
    return;
  }
  const container = el.offsetParent as HTMLElement;
  if (el.offsetTop > container.scrollTop + container.offsetHeight || el.offsetTop < container.scrollTop) {
    container.scrollTop = el.offsetTop - container.offsetTop;
  }
}

interface TypeaheadItemProps {
  isSelected: boolean;
  item: CompletionItem;
  onClickItem: (Suggestion) => void;
  prefix?: string;
}

class TypeaheadItem extends React.PureComponent<TypeaheadItemProps> {
  el: HTMLElement;

  componentDidUpdate(prevProps) {
    if (this.props.isSelected && !prevProps.isSelected) {
      requestAnimationFrame(() => {
        scrollIntoView(this.el);
      });
    }
  }

  getRef = el => {
    this.el = el;
  };

  onClick = () => {
    this.props.onClickItem(this.props.item);
  };

  render() {
    const { isSelected, item, prefix } = this.props;
    const className = isSelected ? 'typeahead-item typeahead-item__selected' : 'typeahead-item';
    const { label } = item;
    return (
      <li ref={this.getRef} className={className} onClick={this.onClick}>
        <Highlighter textToHighlight={label} searchWords={[prefix]} highlightClassName="typeahead-match" />
        {item.documentation && isSelected ? <div className="typeahead-item-hint">{item.documentation}</div> : null}
      </li>
    );
  }
}

interface TypeaheadGroupProps {
  items: CompletionItem[];
  label: string;
  onClickItem: (CompletionItem) => void;
  selected: CompletionItem;
  prefix?: string;
}

class TypeaheadGroup extends React.PureComponent<TypeaheadGroupProps> {
  render() {
    const { items, label, selected, onClickItem, prefix } = this.props;
    return (
      <li className="typeahead-group">
        <div className="typeahead-group__title">{label}</div>
        <ul className="typeahead-group__list">
          {items.map(item => {
            return (
              <TypeaheadItem
                key={item.label}
                onClickItem={onClickItem}
                isSelected={selected === item}
                item={item}
                prefix={prefix}
              />
            );
          })}
        </ul>
      </li>
    );
  }
}

interface TypeaheadProps {
  groupedItems: CompletionItemGroup[];
  menuRef: any;
  selectedItem: CompletionItem | null;
  onClickItem: (Suggestion) => void;
  prefix?: string;
}
class Typeahead extends React.PureComponent<TypeaheadProps> {
  render() {
    const { groupedItems, menuRef, selectedItem, onClickItem, prefix } = this.props;
    return (
      <ul className="typeahead" ref={menuRef}>
        {groupedItems.map(g => (
          <TypeaheadGroup key={g.label} onClickItem={onClickItem} prefix={prefix} selected={selectedItem} {...g} />
        ))}
      </ul>
    );
  }
}

export default Typeahead;
