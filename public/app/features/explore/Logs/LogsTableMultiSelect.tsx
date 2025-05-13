import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { useTheme2 } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';

import { LogsTableActiveFields } from './LogsTableActiveFields';
import { LogsTableAvailableFields } from './LogsTableAvailableFields';
import { FieldNameMeta } from './LogsTableWrap';

function getStyles(theme: GrafanaTheme2) {
  return {
    sidebarWrap: css({
      overflowY: 'scroll',
      height: 'calc(100% - 50px)',
      /* Hide scrollbar for Chrome, Safari, and Opera */
      '&::-webkit-scrollbar': {
        display: 'none',
      },
      /* Hide scrollbar for Firefox */
      scrollbarWidth: 'none',
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
  filteredColumnsWithMeta: Record<string, FieldNameMeta> | undefined;
  columnsWithMeta: Record<string, FieldNameMeta>;
  clear: () => void;
  reorderColumn: (oldIndex: number, newIndex: number) => void;
}) => {
  const theme = useTheme2();
  const styles = getStyles(theme);

  return (
    <div className={styles.sidebarWrap}>
      {/* Sidebar columns */}
      <>
        <div className={styles.columnHeader}>
          <Trans i18nKey="explore.logs-table-multi-select.selected-fields">Selected fields</Trans>
          <button onClick={props.clear} className={styles.columnHeaderButton}>
            <Trans i18nKey="explore.logs-table-multi-select.reset">Reset</Trans>
          </button>
        </div>
        <LogsTableActiveFields
          reorderColumn={props.reorderColumn}
          toggleColumn={props.toggleColumn}
          labels={props.filteredColumnsWithMeta ?? props.columnsWithMeta}
          valueFilter={(value) => props.columnsWithMeta[value]?.active ?? false}
          id={'selected-fields'}
        />

        <div className={styles.columnHeader}>
          <Trans i18nKey="explore.logs-table-multi-select.fields">Fields</Trans>
        </div>
        <LogsTableAvailableFields
          toggleColumn={props.toggleColumn}
          labels={props.filteredColumnsWithMeta ?? props.columnsWithMeta}
          valueFilter={(value) => !props.columnsWithMeta[value]?.active}
        />
      </>
    </div>
  );
};
