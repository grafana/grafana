import { cx, css } from '@emotion/css';
import { memo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../..';

export interface ListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => JSX.Element;
  getItemKey?: (item: T) => string;
  className?: string;
}

interface AbstractListProps<T> extends ListProps<T> {
  inline?: boolean;
}

function AbstractListComponent<T>({ items, renderItem, getItemKey, className, inline }: AbstractListProps<T>) {
  const styles = useStyles2(getStyles, inline);

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

const getStyles = (theme: GrafanaTheme2, inlineList = false) => ({
  list: css({
    listStyleType: 'none',
    margin: 0,
    padding: 0,
  }),

  item: css({
    display: (inlineList && 'inline-block') || 'block',
  }),
});

export const AbstractList = memo(AbstractListComponent);
