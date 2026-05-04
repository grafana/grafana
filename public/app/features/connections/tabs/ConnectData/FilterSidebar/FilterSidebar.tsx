import { css, cx } from '@emotion/css';

import type { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Field, RadioButtonList, Tooltip, Select, Combobox, useStyles2 } from '@grafana/ui';

import { SORT_OPTIONS } from '../constants';

export interface FilterState {
  groupBy: string;
  categoryFilter: string;
  typeFilter: string;
  filterBy: string;
  sortBy: string;
}

export interface FilterHandlers {
  onCategoryFilterChange: (value: SelectableValue<string>) => void;
  onTypeFilterChange: (value: SelectableValue<string>) => void;
  onFilterByChange: (value: string) => void;
  onSortByChange: (value: SelectableValue<string>) => void;
}

export interface FilterSidebarProps {
  state: FilterState;
  handlers: FilterHandlers;
  categoryFilterOptions: SelectableValue[];
  typeFilterOptions: SelectableValue[];
  filterByOptions: SelectableValue[];
  remotePluginsAvailable: boolean;
}

const getStyles = (theme: GrafanaTheme2) => ({
  filterSection: css({
    padding: theme.spacing(2),
    overflow: 'auto',
    width: '100%',
    minWidth: 0,
  }),
  filterField: css({
    position: 'relative',
    marginBottom: theme.spacing(3),
    width: '100%',
  }),
  filterFieldLast: css({
    marginBottom: 0,
  }),
  filterLabel: css({
    color: theme.colors.text.secondary,
  }),
  activeDot: css({
    position: 'absolute',
    top: 0,
    right: 0,
    width: 6,
    height: 6,
    borderRadius: theme.shape.radius.circle,
    backgroundColor: theme.colors.warning.text,
    opacity: 0.8,
  }),
});

export function FilterSidebar({
  state,
  handlers,
  categoryFilterOptions,
  typeFilterOptions,
  filterByOptions,
  remotePluginsAvailable,
}: FilterSidebarProps) {
  const styles = useStyles2(getStyles);
  const sortOptions = SORT_OPTIONS();

  return (
    <div className={styles.filterSection}>
      {/* Filter by category (when grouped by type) or by type (when grouped by category) */}
      {state.groupBy === 'type' ? (
        <div className={styles.filterField}>
          {state.categoryFilter !== 'all' && <div className={styles.activeDot} />}
          <Field
            label={
              <span className={styles.filterLabel}>{t('connections.add-new-connection.category', 'Category')}</span>
            }
            noMargin
          >
            <Select
              aria-label={t('connections.add-new-connection.filter-by-category', 'Filter by category')}
              value={state.categoryFilter}
              onChange={handlers.onCategoryFilterChange}
              options={categoryFilterOptions}
            />
          </Field>
        </div>
      ) : (
        <div className={styles.filterField}>
          {state.typeFilter !== 'all' && <div className={styles.activeDot} />}
          <Field
            label={<span className={styles.filterLabel}>{t('connections.add-new-connection.type', 'Type')}</span>}
            noMargin
          >
            <Select
              aria-label={t('connections.add-new-connection.filter-by-type', 'Filter by type')}
              value={state.typeFilter}
              onChange={handlers.onTypeFilterChange}
              options={typeFilterOptions}
            />
          </Field>
        </div>
      )}

      {/* Filter by installed / all */}
      <div className={styles.filterField}>
        {state.filterBy !== 'all' && <div className={styles.activeDot} />}
        <Field
          label={<span className={styles.filterLabel}>{t('connections.add-new-connection.state', 'State')}</span>}
          noMargin
        >
          {remotePluginsAvailable ? (
            <RadioButtonList
              name="filterBy"
              value={state.filterBy}
              onChange={handlers.onFilterByChange}
              options={filterByOptions}
            />
          ) : (
            <Tooltip
              content={t(
                'connections.add-new-connection.filter-by-state-disabled',
                'This filter has been disabled because the Grafana server cannot access grafana.com'
              )}
              placement="top"
            >
              <RadioButtonList
                name="filterBy"
                disabled={true}
                value={state.filterBy}
                onChange={handlers.onFilterByChange}
                options={filterByOptions}
              />
            </Tooltip>
          )}
        </Field>
      </div>

      {/* Sorting */}
      <div className={cx(styles.filterField, styles.filterFieldLast)}>
        {state.sortBy !== 'nameAsc' && <div className={styles.activeDot} />}
        <Field
          label={<span className={styles.filterLabel}>{t('connections.add-new-connection.sort', 'Sort')}</span>}
          noMargin
        >
          <Combobox
            aria-label={t('connections.add-new-connection.sort-list', 'Sort Plugins List')}
            value={state.sortBy}
            onChange={handlers.onSortByChange}
            options={sortOptions}
          />
        </Field>
      </div>
    </div>
  );
}
