import { cx, css } from '@emotion/css';
import { useMemo, type JSX } from 'react';

import { Trans } from '@grafana/i18n';

import { stylesFactory } from '../../themes/stylesFactory';
import { Button } from '../Button/Button';

import { useLimit } from './hooks';

export interface ListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => JSX.Element;
  getItemKey?: (item: T) => string;
  className?: string;
  limit?: number;
}

interface AbstractListProps<T> extends ListProps<T> {
  inline?: boolean;
  limit?: number;
}

const getStyles = stylesFactory((inlineList = false) => ({
  list: css({
    listStyleType: 'none',
    margin: 0,
    padding: 0,
  }),

  item: css({
    display: (inlineList && 'inline-block') || 'block',
  }),
}));

/** @deprecated Use ul/li/arr.map directly instead */
// no point converting, this is deprecated
// eslint-disable-next-line react-prefer-function-component/react-prefer-function-component
export const AbstractList = <T,>({
  items,
  renderItem,
  getItemKey,
  className,
  inline,
  limit = 0,
}: AbstractListProps<T>) => {
  const styles = getStyles(inline);

  const [curLimit, setLimit] = useLimit(limit);

  const limitedItems = useMemo(() => (curLimit > 0 ? items.slice(0, curLimit) : items), [items, curLimit]);

  return (
    <ul className={cx(styles.list, className)}>
      {limitedItems.map((item, i) => {
        return (
          <li className={styles.item} key={getItemKey ? getItemKey(item) : i}>
            {renderItem(item, i)}
          </li>
        );
      })}
      {curLimit > 0 && items.length > curLimit && (
        <li className={styles.item} key="__limit">
          <Button fill="text" variant="primary" size="sm" onClick={() => setLimit(0)}>
            <Trans i18nKey={'legend.container.show-all-series'}>...show all {{ total: items.length }} items</Trans>
          </Button>
        </li>
      )}
    </ul>
  );
};
