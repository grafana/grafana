import { css } from '@emotion/css';
import { useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { FilterInput, Icon, Text, useStyles2 } from '@grafana/ui';

import { type DatasourceDef, type TableDef, mockSchema } from '../mocks/schema';

interface Props {
  onTableClick: (tableName: string) => void;
  onColumnClick?: (tableName: string, columnName: string) => void;
}

export function SourcesPanel({ onTableClick, onColumnClick }: Props) {
  const styles = useStyles2(getStyles);
  const [search, setSearch] = useState('');
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  const [expandedDatasources, setExpandedDatasources] = useState<Set<string>>(new Set(['Prometheus']));

  const toggleTable = (tableName: string) => {
    setExpandedTables((prev) => {
      const next = new Set(prev);
      next.has(tableName) ? next.delete(tableName) : next.add(tableName);
      return next;
    });
  };

  const toggleDatasource = (dsName: string) => {
    setExpandedDatasources((prev) => {
      const next = new Set(prev);
      next.has(dsName) ? next.delete(dsName) : next.add(dsName);
      return next;
    });
  };

  const filterTables = (ds: DatasourceDef): TableDef[] => {
    if (!search) {
      return ds.tables;
    }
    const q = search.toLowerCase();
    return ds.tables.filter(
      (t) =>
        t.name.toLowerCase().includes(q) || t.columns.some((c) => c.name.toLowerCase().includes(q))
    );
  };

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <Text variant="bodySmall" weight="bold" color="secondary">
          SOURCES
        </Text>
      </div>
      <div className={styles.search}>
        <FilterInput placeholder="Search tables…" value={search} onChange={setSearch} />
      </div>
      <div className={styles.tree}>
        {mockSchema.map((ds) => {
          const filteredTables = filterTables(ds);
          const isOpen = expandedDatasources.has(ds.name);
          return (
            <div key={ds.name}>
              <button className={styles.dsRow} onClick={() => toggleDatasource(ds.name)}>
                <Icon name={isOpen ? 'angle-down' : 'angle-right'} size="sm" />
                <Icon name="database" size="sm" className={styles.dsIcon} />
                <span className={styles.dsName}>{ds.name}</span>
              </button>
              {isOpen && (
                <div className={styles.tableList}>
                  {filteredTables.map((table) => {
                    const tableOpen = expandedTables.has(table.name);
                    return (
                      <div key={table.name}>
                        <button
                          className={styles.tableRow}
                          onClick={() => {
                            toggleTable(table.name);
                            onTableClick(table.name);
                          }}
                        >
                          <Icon name={tableOpen ? 'angle-down' : 'angle-right'} size="sm" />
                          <Icon name="table" size="sm" className={styles.tableIcon} />
                          <span className={styles.tableName}>{table.name}</span>
                        </button>
                        {tableOpen && (
                          <div className={styles.columnList}>
                            {table.columns.map((col) => (
                              <button
                                key={col.name}
                                className={styles.columnRow}
                                onClick={() => onColumnClick?.(table.name, col.name)}
                                title={col.description}
                              >
                                <span className={styles.columnTypeIcon}>
                                  {col.type === 'timestamp' ? '⏱' : col.type === 'value' ? '#' : 'T'}
                                </span>
                                <span className={styles.columnName}>{col.name}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {filteredTables.length === 0 && (
                    <div className={styles.empty}>No tables match</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    root: css({
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden',
      background: theme.colors.background.primary,
      borderRight: `1px solid ${theme.colors.border.weak}`,
    }),
    header: css({
      padding: theme.spacing(1.5, 2, 0.5),
    }),
    search: css({
      padding: theme.spacing(0.5, 1, 1),
    }),
    tree: css({
      flex: 1,
      overflowY: 'auto',
    }),
    dsRow: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(0.5),
      width: '100%',
      padding: theme.spacing(0.75, 1),
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      color: theme.colors.text.primary,
      '&:hover': {
        background: theme.colors.action.hover,
      },
    }),
    dsIcon: css({ color: theme.colors.primary.text }),
    dsName: css({
      fontSize: theme.typography.bodySmall.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
    }),
    tableList: css({
      paddingLeft: theme.spacing(1),
    }),
    tableRow: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(0.5),
      width: '100%',
      padding: theme.spacing(0.5, 1),
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      color: theme.colors.text.primary,
      '&:hover': {
        background: theme.colors.action.hover,
      },
    }),
    tableIcon: css({ color: theme.colors.warning.text }),
    tableName: css({
      fontSize: theme.typography.bodySmall.fontSize,
      fontFamily: theme.typography.fontFamilyMonospace,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    }),
    columnList: css({
      paddingLeft: theme.spacing(3.5),
    }),
    columnRow: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(0.75),
      width: '100%',
      padding: theme.spacing(0.25, 1),
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      color: theme.colors.text.secondary,
      '&:hover': {
        color: theme.colors.text.primary,
        background: theme.colors.action.hover,
      },
    }),
    columnTypeIcon: css({
      fontSize: '10px',
      width: '14px',
      textAlign: 'center',
      color: theme.colors.text.disabled,
    }),
    columnName: css({
      fontSize: theme.typography.bodySmall.fontSize,
      fontFamily: theme.typography.fontFamilyMonospace,
    }),
    empty: css({
      padding: theme.spacing(1, 2),
      color: theme.colors.text.disabled,
      fontSize: theme.typography.bodySmall.fontSize,
    }),
  };
}
