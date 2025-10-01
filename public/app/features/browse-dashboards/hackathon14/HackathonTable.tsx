import { css } from '@emotion/css';
import { useState, ReactNode } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Text, useStyles2, Icon } from '@grafana/ui';

export interface TableColumn {
  key: string;
  header: string;
  width: string; // CSS grid width (e.g., '2fr', '200px')
  render: (item: any) => ReactNode;
}

export interface ExpandedContent {
  render: (item: any) => ReactNode;
}

interface HackathonTableProps {
  columns: TableColumn[];
  data: any[];
  expandable?: boolean;
  expandedContent?: ExpandedContent;
  onRowClick?: (item: any) => void;
  emptyMessage?: string;
}

export const HackathonTable = ({
  columns,
  data,
  expandable = false,
  expandedContent,
  onRowClick,
  emptyMessage = 'No data available',
}: HackathonTableProps) => {
  const styles = useStyles2(getStyles);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRowExpansion = (uid: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setExpandedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(uid)) {
        newSet.delete(uid);
      } else {
        newSet.add(uid);
      }
      return newSet;
    });
  };

  const handleRowClick = (item: any, event: React.MouseEvent) => {
    if (expandable) {
      toggleRowExpansion(item.uid, event);
    } else if (onRowClick) {
      onRowClick(item);
    }
  };

  // Calculate grid template columns
  const toggleColumn = expandable ? '40px ' : '';
  const gridTemplateColumns = toggleColumn + columns.map((col) => col.width).join(' ');

  if (data.length === 0) {
    return (
      <div className={styles.emptyState}>
        <Text color="secondary">{emptyMessage}</Text>
      </div>
    );
  }

  return (
    <div className={styles.tableWrapper}>
      <div className={styles.tableHeader} style={{ gridTemplateColumns }}>
        {expandable && <div className={styles.columnToggle}></div>}
        {columns.map((col) => (
          <div key={col.key} className={styles.columnHeader}>
            {col.header}
          </div>
        ))}
      </div>

      <div className={styles.tableBody}>
        {data.map((item) => {
          const isExpanded = expandedRows.has(item.uid);
          return (
            <div key={item.uid}>
              <div
                className={`${styles.tableRow} ${isExpanded ? styles.rowExpanded : ''}`}
                style={{ gridTemplateColumns }}
                onClick={(e) => handleRowClick(item, e)}
              >
                {expandable && (
                  <div className={styles.columnToggle}>
                    <Icon
                      name={isExpanded ? 'angle-down' : 'angle-right'}
                      size="sm"
                      className={styles.expandIcon}
                    />
                  </div>
                )}
                {columns.map((col) => (
                  <div key={col.key} className={styles.columnCell}>
                    {col.render(item)}
                  </div>
                ))}
              </div>

              {expandable && isExpanded && expandedContent && (
                <div className={styles.expandedRow}>{expandedContent.render(item)}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  tableWrapper: css({
    borderRadius: theme.shape.radius.default,
    border: `1px solid ${theme.colors.border.weak}`,
    overflow: 'hidden',
    background: theme.colors.background.primary,
  }),

  tableHeader: css({
    display: 'grid',
    gap: theme.spacing(1.5),
    padding: theme.spacing(1.5, 3),
    background: theme.colors.background.secondary,
    borderBottom: `1px solid ${theme.colors.border.weak}`,
    fontWeight: theme.typography.fontWeightMedium,
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.secondary,
  }),

  tableBody: css({
    display: 'flex',
    flexDirection: 'column',
  }),

  tableRow: css({
    display: 'grid',
    gap: theme.spacing(1.5),
    padding: theme.spacing(1.75, 3),
    borderBottom: `1px solid rgba(255, 255, 255, 0.06)`,
    cursor: 'pointer',
    transition: 'background-color 0.2s ease, box-shadow 0.2s ease',
    alignItems: 'center',

    '&:hover': {
      background: theme.colors.background.secondary,
      boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
    },
  }),

  rowExpanded: css({
    background: theme.colors.background.secondary,
  }),

  columnToggle: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0,
  }),

  columnHeader: css({
    display: 'flex',
    alignItems: 'center',
    minWidth: 0,
    textTransform: 'uppercase',
    letterSpacing: '0.02em',
  }),

  columnCell: css({
    display: 'flex',
    alignItems: 'center',
    minWidth: 0,
    overflow: 'hidden',
    gap: theme.spacing(1),
  }),

  expandIcon: css({
    color: theme.colors.text.secondary,
    flexShrink: 0,
  }),

  expandedRow: css({
    padding: theme.spacing(3, 3, 3, 6),
    background: theme.colors.background.secondary,
    borderBottom: `1px solid rgba(255,255,255,0.06)`,
    borderLeft: `3px solid ${theme.colors.primary.main}`,
  }),

  emptyState: css({
    padding: theme.spacing(4),
    textAlign: 'center',
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
  }),
});

