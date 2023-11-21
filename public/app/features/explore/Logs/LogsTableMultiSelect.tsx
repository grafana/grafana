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
    columnHeaderButton: css({
      appearance: 'none',
      background: 'none',
      border: 'none',
      fontSize: theme.typography.pxToRem(11),
    }),
    columnHeader: css({
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: theme.typography.h6.fontSize,
      background: theme.colors.background.secondary,
      position: 'sticky',
      top: 0,
      left: 0,
      paddingTop: theme.spacing(0.75),
      paddingRight: theme.spacing(0.75),
      paddingBottom: theme.spacing(0.75),
      paddingLeft: theme.spacing(1.5),
      zIndex: 3,
      marginBottom: theme.spacing(2),
    }),
  };
}

export const LogsTableMultiSelect = (props: {
  toggleColumn: (columnName: string) => void;
  filteredColumnsWithMeta: Record<string, fieldNameMeta> | undefined;
  columnsWithMeta: Record<string, fieldNameMeta>;
  clear: () => void;
}) => {
  const theme = useTheme2();
  const styles = getStyles(theme);

  return (
    <div className={styles.sidebarWrap}>
      {/* Sidebar columns */}
      <>
        <div className={styles.columnHeader}>
          Selected fields
          <button onClick={props.clear} className={styles.columnHeaderButton}>
            Reset
          </button>
        </div>
        <LogsTableNavColumn
          toggleColumn={props.toggleColumn}
          labels={props.filteredColumnsWithMeta ?? props.columnsWithMeta}
          valueFilter={(value) => props.columnsWithMeta[value]?.active ?? false}
        />

        <div className={styles.columnHeader}>Fields</div>
        <LogsTableNavColumn
          toggleColumn={props.toggleColumn}
          labels={props.filteredColumnsWithMeta ?? props.columnsWithMeta}
          valueFilter={(value) => !props.columnsWithMeta[value]?.active}
        />
      </>
    </div>
  );
};
