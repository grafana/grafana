import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { AdHocFiltersVariable, GroupByVariable } from '@grafana/scenes';
import { Button, Stack, useStyles2 } from '@grafana/ui';

import { FilterRow, GroupHeader } from './FiltersOverviewRow';
import { useFiltersOverviewState } from './useFiltersOverviewState';

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

  const { state, listItems, operatorConfig, actions, hasKeys, hasAdhocFilters } = useFiltersOverviewState({
    adhocFilters,
    groupByVariable,
    searchQuery,
  });

  if (!hasAdhocFilters) {
    return <div>{t('dashboard.filters-overview.missing-adhoc', 'No ad hoc filters available')}</div>;
  }

  if (!hasKeys) {
    return <div>{t('dashboard.filters-overview.empty', 'No labels available')}</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.listContainer}>
        {listItems.map((item) => {
          if (item.type === 'group') {
            return (
              <GroupHeader
                key={`group-${item.group}`}
                group={item.group}
                isOpen={state.openGroups[item.group] ?? true}
                onToggle={actions.toggleGroup}
              />
            );
          }

          const { keyOption, keyValue } = item;
          const operatorValue = state.operatorsByKey[keyValue] ?? '=';

          return (
            <FilterRow
              key={`row-${keyValue}-${keyOption.group ?? 'ungrouped'}`}
              keyOption={keyOption}
              keyValue={keyValue}
              operatorValue={operatorValue}
              isMultiOperator={operatorConfig.multiValues.has(operatorValue)}
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
          );
        })}
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
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
  }),
  footer: css({
    marginTop: theme.spacing(2),
    paddingTop: theme.spacing(1.5),
    borderTop: `1px solid ${theme.colors.border.weak}`,
  }),
});
