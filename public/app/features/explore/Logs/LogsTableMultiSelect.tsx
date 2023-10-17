import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data/src';
import { useTheme2 } from '@grafana/ui/src';

import { LogsTableNavColumn } from './LogsTableNavColumn';
import { fieldNameMeta } from './LogsTableWrap';

function getStyles(theme: GrafanaTheme2) {
  return {
    sidebarWrap: css({
      overflowY: 'scroll',
      height: 'calc(100% - 50px)',
    }),
    columnHeader: css({
      fontSize: theme.typography.h6.fontSize,
      background: theme.colors.background.secondary,
      position: 'sticky',
      top: 0,
      left: 0,
      padding: '6px 6px 6px 15px',
      zIndex: 3,
      marginBottom: theme.spacing(2),
    }),
  };
}

export const LogsTableMultiSelect = (props: {
  toggleColumn: (columnName: string) => void;
  filteredColumnsWithMeta: Record<string, fieldNameMeta> | undefined;
  columnsWithMeta: Record<string, fieldNameMeta>;
}) => {
  const theme = useTheme2();
  const styles = getStyles(theme);

  return (
    <div className={styles.sidebarWrap}>
      {/* Sidebar columns */}
      <>
        <div className={styles.columnHeader}>Common columns</div>
        <LogsTableNavColumn
          toggleColumn={props.toggleColumn}
          labels={props.filteredColumnsWithMeta ?? props.columnsWithMeta}
          valueFilter={(value) => value === 100}
        />
        <div className={styles.columnHeader}>Available columns</div>
        <LogsTableNavColumn
          toggleColumn={props.toggleColumn}
          labels={props.filteredColumnsWithMeta ?? props.columnsWithMeta}
          valueFilter={(value) => !!value && value !== 100}
        />
        <div className={styles.columnHeader}>Empty columns</div>
        <LogsTableNavColumn
          toggleColumn={props.toggleColumn}
          labels={props.filteredColumnsWithMeta ?? props.columnsWithMeta}
          valueFilter={(value) => !value}
        />
      </>
    </div>
  );
};
