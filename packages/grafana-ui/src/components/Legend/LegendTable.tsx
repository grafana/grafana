import React, { useEffect, useState } from 'react';
import sortBy from 'lodash/sortBy';
import { LegendComponentProps, LegendItem } from './Legend';
import { css } from 'emotion';

interface LegendTableProps extends LegendComponentProps {
  onToggleSort?: (sortBy: string, sortDesc: boolean) => void;
  columns: string[];
  sortBy?: string;
  sortDesc?: boolean;
}

const useLegendTableSort = (items: LegendItem[], sortByKey?: string, sortDesc?: boolean) => {
  const [sortedItems, setSortedItems] = useState(items);

  useEffect(() => {
    if (sortByKey) {
      const sortedItems = sortBy(items, item => {
        if (item.info) {
          const stat = item.info.filter(stat => stat.title === sortByKey)[0];
          return stat && stat.numeric;
        }
        return undefined;
      });

      if (sortDesc) {
        sortedItems.reverse();
      }

      setSortedItems(sortedItems);
    }
  }, [sortByKey, sortDesc]);

  return sortedItems;
};

export const LegendTable: React.FunctionComponent<LegendTableProps> = ({
  items,
  columns,
  sortBy,
  sortDesc,
  itemRenderer,
  onToggleSort,
}) => {
  const sortedItems = useLegendTableSort(items, sortBy, sortDesc);

  return (
    <table
      className={css`
        width: 100%;
        td {
          padding: 2px 10px;
        }
      `}
    >
      <thead>
        <tr>
          {columns.map(columnHeader => {
            return (
              <td
                onClick={() => {
                  if (onToggleSort) {
                    onToggleSort(columnHeader, sortDesc ? false : true);
                  }
                }}
              >
                {columnHeader}
              </td>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {sortedItems.map((item, index) => {
          console.log(item);
          return <tr key={`${item.label}-${index}`}>{itemRenderer ? itemRenderer(item) : <td>{item.label}</td>}</tr>;
        })}
      </tbody>
    </table>
  );
};
