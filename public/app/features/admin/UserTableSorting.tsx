import { css } from '@emotion/css';
import { type ReactNode, useState } from 'react';

import { Icon } from '@grafana/ui';

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

export function useUserTableSort<T, K extends string>(rows: T[], accessors: Record<K, (row: T) => string | number>) {
  const [sort, setSort] = useState<{ key: K; descending: boolean }>();
  const sortedRows = sort
    ? [...rows].sort((a, b) => {
        const left = accessors[sort.key](a);
        const right = accessors[sort.key](b);
        const comparison =
          typeof left === 'number' && typeof right === 'number'
            ? left - right
            : collator.compare(String(left), String(right));
        return sort.descending ? -comparison : comparison;
      })
    : rows;

  const headerProps = (key: K) => ({
    direction: sort?.key === key ? (sort.descending ? ('descending' as const) : ('ascending' as const)) : undefined,
    onSort: () => setSort((previous) => ({ key, descending: previous?.key === key && !previous.descending })),
  });
  return { sortedRows, headerProps };
}

export function UserSortableHeader({
  children,
  direction,
  onSort,
}: {
  children: ReactNode;
  direction?: 'ascending' | 'descending';
  onSort: () => void;
}) {
  return (
    <th aria-sort={direction ?? 'none'}>
      <button type="button" className={headerStyle} onClick={onSort}>
        {children}
        <Icon
          name={direction === 'ascending' ? 'angle-up' : direction === 'descending' ? 'angle-down' : 'sort-amount-down'}
          aria-hidden="true"
        />
      </button>
    </th>
  );
}

const headerStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  width: '100%',
  border: 0,
  padding: 0,
  background: 'none',
  color: 'inherit',
  font: 'inherit',
  textAlign: 'left',
  cursor: 'pointer',
});
