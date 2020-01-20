import React from 'react';
import { cx, css } from 'emotion';
import { stylesFactory } from '../../themes';

export interface ListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => JSX.Element;
  getItemKey?: (item: T) => string;
  className?: string;
}

interface AbstractListProps<T> extends ListProps<T> {
  inline?: boolean;
}

const getStyles = stylesFactory((inlineList = false) => ({
  list: css`
    list-style-type: none;
    margin: 0;
    padding: 0;
  `,

  item: css`
    display: ${(inlineList && 'inline-block') || 'block'};
  `,
}));

export class AbstractList<T> extends React.PureComponent<AbstractListProps<T>> {
  constructor(props: AbstractListProps<T>) {
    super(props);
  }

  render() {
    const { items, renderItem, getItemKey, className, inline } = this.props;
    const styles = getStyles(inline);

    return (
      <ul className={cx(styles.list, className)}>
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
