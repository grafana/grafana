import React from 'react';
import { cx, css } from 'emotion';

export interface ListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => JSX.Element;
  getItemKey?: (item: T) => string;
  className?: string;
}

interface AbstractListProps<T> extends ListProps<T> {
  inline?: boolean;
}

export class AbstractList<T> extends React.PureComponent<AbstractListProps<T>> {
  constructor(props: AbstractListProps<T>) {
    super(props);
    this.getListStyles = this.getListStyles.bind(this);
  }

  getListStyles() {
    const { inline, className } = this.props;
    return {
      list: cx([
        css`
          list-style-type: none;
          margin: 0;
          padding: 0;
        `,
        className,
      ]),
      item: css`
        display: ${(inline && 'inline-block') || 'block'};
      `,
    };
  }

  render() {
    const { items, renderItem, getItemKey } = this.props;
    const styles = this.getListStyles();
    return (
      <ul className={styles.list}>
        {items.map((item, i) => {
          return (
            <li className={styles.item} key={getItemKey ? getItemKey(item) : i}>
              {renderItem(item, i)}
            </li>
          );
        })}
      </ul>
    );
  }
}
