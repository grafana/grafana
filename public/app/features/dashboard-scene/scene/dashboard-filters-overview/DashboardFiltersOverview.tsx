import { css } from '@emotion/css';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';
import Skeleton from 'react-loading-skeleton';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { AdHocFiltersVariable, GroupByVariable } from '@grafana/scenes';
import { Button, Stack, useStyles2 } from '@grafana/ui';

import { FilterRow, GroupHeader } from './FiltersOverviewRow';
import { useFiltersOverviewState } from './useFiltersOverviewState';
import { MULTI_OPERATOR_VALUES } from './utils';

const GROUP_HEADER_HEIGHT = 32;
const FILTER_ROW_HEIGHT = 32;
const ROW_GAP = 8;
const SKELETON_ROW_COUNT = 5;

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
  const scrollRef = useRef<HTMLDivElement>(null);

  const { state, listItems, operatorConfig, actions, loading, hasKeys, hasAdhocFilters } = useFiltersOverviewState({
    adhocFilters,
    groupByVariable,
    searchQuery,
  });

  const virtualizer = useVirtualizer({
    count: listItems.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => (listItems[index]?.type === 'group' ? GROUP_HEADER_HEIGHT : FILTER_ROW_HEIGHT),
    measureElement: (element) => element.getBoundingClientRect().height,
    overscan: 5,
    gap: ROW_GAP,
  });

  if (!hasAdhocFilters) {
    return <div>{t('dashboard.filters-overview.missing-adhoc', 'No ad hoc filters available')}</div>;
  }

  if (loading) {
    return (
      <div className={styles.skeletonContainer}>
        {Array.from({ length: SKELETON_ROW_COUNT }, (_, i) => (
          <Skeleton key={i} height={FILTER_ROW_HEIGHT} containerClassName={styles.skeletonRow} />
        ))}
      </div>
    );
  }

  if (!hasKeys) {
    return <div>{t('dashboard.filters-overview.empty', 'No labels available')}</div>;
  }

  return (
    <div className={styles.container}>
      <div ref={scrollRef} className={styles.listContainer}>
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const item = listItems[virtualRow.index];
            if (!item) {
              return null;
            }

            if (item.type === 'group') {
              return (
                <div
                  key={`group-${item.group}`}
                  ref={virtualizer.measureElement}
                  data-index={virtualRow.index}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <GroupHeader
                    group={item.group}
                    isOpen={state.openGroups[item.group] ?? true}
                    onToggle={actions.toggleGroup}
                  />
                </div>
              );
            }

            const { keyOption, keyValue } = item;
            const operatorValue = state.operatorsByKey[keyValue] ?? '=';

            return (
              <div
                key={`row-${keyValue}-${keyOption.group ?? 'ungrouped'}`}
                ref={virtualizer.measureElement}
                data-index={virtualRow.index}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <FilterRow
                  keyOption={keyOption}
                  keyValue={keyValue}
                  operatorValue={operatorValue}
                  isMultiOperator={MULTI_OPERATOR_VALUES.has(operatorValue)}
                  singleValue={state.singleValuesByKey[keyValue] ?? ''}
                  multiValues={state.multiValuesByKey[keyValue] ?? []}
                  isGroupBy={state.isGrouped[keyValue] ?? false}
                  isOrigin={state.isOriginByKey[keyValue] ?? false}
                  hasGroupByVariable={Boolean(groupByVariable)}
                  operatorOptions={operatorConfig.options}
                  onOperatorChange={actions.setOperator}
                  onSingleValueChange={actions.setSingleValue}
                  onMultiValuesChange={actions.setMultiValues}
                  onGroupByToggle={actions.toggleGroupBy}
                  getValueOptions={actions.getValueOptionsForKey}
                />
              </div>
            );
          })}
        </div>
      </div>

      <Footer
        onApply={actions.applyChanges}
        onApplyAndClose={() => {
          actions.applyChanges();
          onClose();
        }}
        onClose={onClose}
      />
    </div>
  );
};

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

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
  }),
  skeletonContainer: css({
    display: 'flex',
    flexDirection: 'column',
    gap: ROW_GAP,
    width: '100%',
  }),
  skeletonRow: css({
    display: 'block',
    lineHeight: 1,
  }),
  listContainer: css({
    width: '100%',
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
  }),
  footer: css({
    marginTop: theme.spacing(2),
    paddingTop: theme.spacing(1.5),
    borderTop: `1px solid ${theme.colors.border.weak}`,
  }),
});
