import React from 'react';

function scrollIntoView(el: any) {
  if (!el || !el.offsetParent) {
    return;
  }
  const container = el.offsetParent;
  if (el.offsetTop > container.scrollTop + container.offsetHeight || el.offsetTop < container.scrollTop) {
    container.scrollTop = el.offsetTop - container.offsetTop;
  }
}

class TypeaheadItem extends React.PureComponent<any, any> {
  el: any;
  componentDidUpdate(prevProps: any) {
    if (this.props.isSelected && !prevProps.isSelected) {
      scrollIntoView(this.el);
    }
  }

  getRef = (el: any) => {
    this.el = el;
  };

  render() {
    const { hint, isSelected, label, onClickItem } = this.props;
    const className = isSelected ? 'typeahead-item typeahead-item__selected' : 'typeahead-item';
    const onClick = () => onClickItem(label);
    return (
      <li ref={this.getRef} className={className} onClick={onClick}>
        {label}
        {hint && isSelected ? <div className="typeahead-item-hint">{hint}</div> : null}
      </li>
    );
  }
}

class TypeaheadGroup extends React.PureComponent<any, any> {
  render() {
    const { items, label, selected, onClickItem } = this.props;
    return (
      <li className="typeahead-group">
        <div className="typeahead-group__title">{label}</div>
        <ul className="typeahead-group__list">
          {items.map((item: any) => {
            const text = typeof item === 'object' ? item.text : item;
            const label = typeof item === 'object' ? item.display || item.text : item;
            return (
              <TypeaheadItem
                key={text}
                onClickItem={onClickItem}
                isSelected={selected.indexOf(text) > -1}
                hint={item.hint}
                label={label}
              />
            );
          })}
        </ul>
      </li>
    );
  }
}

class Typeahead extends React.PureComponent<any, any> {
  render() {
    const { groupedItems, menuRef, selectedItems, onClickItem } = this.props;
    return (
      <ul className="typeahead" ref={menuRef}>
        {groupedItems.map((g: any) => (
          <TypeaheadGroup key={g.label} onClickItem={onClickItem} selected={selectedItems} {...g} />
        ))}
      </ul>
    );
  }
}

export default Typeahead;
