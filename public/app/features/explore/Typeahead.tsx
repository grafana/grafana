import React from 'react';

import { Suggestion, SuggestionGroup } from './QueryField';

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
  item: Suggestion;
  onClickItem: (Suggestion) => void;
}

class TypeaheadItem extends React.PureComponent<TypeaheadItemProps, {}> {
  el: HTMLElement;

  componentDidUpdate(prevProps) {
    if (this.props.isSelected && !prevProps.isSelected) {
      scrollIntoView(this.el);
    }
  }

  getRef = el => {
    this.el = el;
  };

  onClick = () => {
    this.props.onClickItem(this.props.item);
  };

  render() {
    const { isSelected, item } = this.props;
    const className = isSelected ? 'typeahead-item typeahead-item__selected' : 'typeahead-item';
    return (
      <li ref={this.getRef} className={className} onClick={this.onClick}>
        {item.detail || item.label}
        {item.documentation && isSelected ? <div className="typeahead-item-hint">{item.documentation}</div> : null}
      </li>
    );
  }
}

interface TypeaheadGroupProps {
  items: Suggestion[];
  label: string;
  onClickItem: (Suggestion) => void;
  selected: Suggestion;
}

class TypeaheadGroup extends React.PureComponent<TypeaheadGroupProps, {}> {
  render() {
    const { items, label, selected, onClickItem } = this.props;
    return (
      <li className="typeahead-group">
        <div className="typeahead-group__title">{label}</div>
        <ul className="typeahead-group__list">
          {items.map(item => {
            return (
              <TypeaheadItem key={item.label} onClickItem={onClickItem} isSelected={selected === item} item={item} />
            );
          })}
        </ul>
      </li>
    );
  }
}

interface TypeaheadProps {
  groupedItems: SuggestionGroup[];
  menuRef: any;
  selectedItem: Suggestion | null;
  onClickItem: (Suggestion) => void;
}
class Typeahead extends React.PureComponent<TypeaheadProps, {}> {
  render() {
    const { groupedItems, menuRef, selectedItem, onClickItem } = this.props;
    return (
      <ul className="typeahead" ref={menuRef}>
        {groupedItems.map(g => (
          <TypeaheadGroup key={g.label} onClickItem={onClickItem} selected={selectedItem} {...g} />
        ))}
      </ul>
    );
  }
}

export default Typeahead;
