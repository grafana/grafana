import React, { useContext } from 'react';
import { css, cx } from 'emotion';
import { LegendComponentProps } from './Legend';
import { ThemeContext } from '../../themes/ThemeContext';

interface LegendTableProps extends LegendComponentProps {
  columns: string[];
  sortBy?: string;
  sortDesc?: boolean;
  onToggleSort?: (sortBy: string) => void;
}

export const LegendTable: React.FunctionComponent<LegendTableProps> = ({
  items,
  columns,
  sortBy,
  sortDesc,
  itemRenderer,
  className,
  onToggleSort,
}) => {
  const theme = useContext(ThemeContext);

  return (
    <table
      className={cx(
        css`
          width: 100%;
          td {
            padding: 2px 10px;
          }
        `,
        className
      )}
    >
      <thead>
        <tr>
          {columns.map(columnHeader => {
            return (
              <th
                key={columnHeader}
                className={css`
                  color: ${theme.colors.blue};
                  font-weight: bold;
                  text-align: right;
                  cursor: pointer;
                `}
                onClick={() => {
                  if (onToggleSort) {
                    onToggleSort(columnHeader);
                  }
                }}
              >
                {columnHeader}
                {sortBy === columnHeader && (
                  <span
                    className={cx(
                      `fa fa-caret-${sortDesc ? 'down' : 'up'}`,
                      css`
                        margin-left: ${theme.spacing.sm};
                      `
                    )}
                  />
                )}
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {items.map((item, index) => {
          return itemRenderer ? (
            itemRenderer(item, index)
          ) : (
            <tr key={`${item.label}-${index}`}>
              <td>{item.label}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};
