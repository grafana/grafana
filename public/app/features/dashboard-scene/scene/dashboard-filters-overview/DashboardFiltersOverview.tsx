import { css } from '@emotion/css';
import { useEffect, useMemo } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';
import { VariableSizeList } from 'react-window';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { AdHocFiltersVariable, GroupByVariable } from '@grafana/scenes';
import { Button, Stack, useStyles2 } from '@grafana/ui';

import { FiltersOverviewRow, RowData } from './FiltersOverviewRow';
import { useFiltersOverviewState, useVirtualListSizing } from './useFiltersOverviewState';

interface DashboardFiltersOverviewProps {
  adhocFilters?: AdHocFiltersVariable;
  groupByVariable?: GroupByVariable;
  onClose: () => void;
  searchQuery?: string;
}

export const DashboardFiltersOverview = ({
  adhocFilters,
  groupByVariable,
  onClose,
  searchQuery = '',
}: DashboardFiltersOverviewProps) => {
  const styles = useStyles2(getStyles);

  // State management
  const { state, listItems, operatorConfig, actions, hasKeys, hasAdhocFilters } = useFiltersOverviewState({
    adhocFilters,
    groupByVariable,
    searchQuery,
  });

  // Virtual list sizing
  const { listWidth, listContainerRef, listRef, setRowHeight, resetSizes, getItemSize } = useVirtualListSizing();

  // Reset sizes when list items or width change
  useEffect(() => {
    resetSizes();
  }, [listItems, listWidth, resetSizes]);

  // Build row data for react-window
  const rowData = useMemo<RowData>(
    () => ({
      items: listItems,
      groupByVariable,
      openGroups: state.openGroups,
      measureKey: listWidth,
      operatorOptions: operatorConfig.options,
      operatorsByKey: state.operatorsByKey,
      multiOperatorValues: operatorConfig.multiValues,
      singleValuesByKey: state.singleValuesByKey,
      multiValuesByKey: state.multiValuesByKey,
      isGrouped: state.isGrouped,
      isOriginByKey: state.isOriginByKey,
      actions: { ...actions, setRowHeight },
    }),
    [listItems, groupByVariable, state, listWidth, operatorConfig, actions, setRowHeight]
  );

  // Action handlers
  const handleApply = () => actions.applyChanges();
  const handleApplyAndClose = () => {
    actions.applyChanges();
    onClose();
  };

  // Early returns for edge cases
  if (!hasAdhocFilters) {
    return <div>{t('dashboard.filters-overview.missing-adhoc', 'No ad hoc filters available')}</div>;
  }

  if (!hasKeys) {
    return <div>{t('dashboard.filters-overview.empty', 'No labels available')}</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.listContainer} ref={listContainerRef}>
        <AutoSizer>
          {({ height, width }) => (
            <VariableSizeList
              ref={listRef}
              height={height}
              width={width}
              itemCount={listItems.length}
              itemSize={(index: number) => getItemSize(index, listItems[index]?.type ?? 'row')}
              style={{ overflowX: 'hidden' }}
              itemKey={(index) => {
                const item = listItems[index];
                return item.type === 'group'
                  ? `group-${item.group}`
                  : `row-${item.keyValue}-${item.keyOption.group ?? 'ungrouped'}`;
              }}
              overscanCount={6}
              itemData={rowData}
            >
              {FiltersOverviewRow}
            </VariableSizeList>
          )}
        </AutoSizer>
      </div>

      <Footer onApply={handleApply} onApplyAndClose={handleApplyAndClose} onClose={onClose} />
    </div>
  );
};

// Footer component
interface FooterProps {
  onApply: () => void;
  onApplyAndClose: () => void;
  onClose: () => void;
}

const Footer = ({ onApply, onApplyAndClose, onClose }: FooterProps) => {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.footer}>
      <Stack direction="row" gap={1} justifyContent="flex-end">
        <Button variant="primary" onClick={onApply}>
          {t('dashboard.filters-overview.apply', 'Apply')}
        </Button>
        <Button variant="secondary" onClick={onApplyAndClose}>
          {t('dashboard.filters-overview.apply-close', 'Apply and close')}
        </Button>
        <Button variant="secondary" onClick={onClose}>
          {t('dashboard.filters-overview.close', 'Close')}
        </Button>
      </Stack>
    </div>
  );
};

// Styles
const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
  }),
  listContainer: css({
    width: '100%',
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  }),
  footer: css({
    marginTop: '16px',
    paddingTop: '12px',
    borderTop: '1px solid var(--border-weak)',
    overflow: 'hidden',
  }),
});
