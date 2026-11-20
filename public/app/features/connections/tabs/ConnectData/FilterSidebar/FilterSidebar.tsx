import { css } from '@emotion/css';

import type { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button, Field, RadioButtonList, Tooltip, Combobox, useStyles2 } from '@grafana/ui';

import { SORT_OPTIONS } from '../constants';

import { ChipSelect } from './ChipSelect';

interface FilterState {
  groupBy: string;
  categoryFilter: string[];
  typeFilter: string[];
  filterBy: string;
  sortBy: string;
}

interface FilterHandlers {
  onCategoryFilterChange: (values: string[]) => void;
  onTypeFilterChange: (values: string[]) => void;
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
  feedbackButton: css({
    width: '100%',
    justifyContent: 'center',
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
      {/* Filter by category */}
      <div className={styles.filterField}>
        {state.categoryFilter.length > 0 && <div className={styles.activeDot} />}
        <Field
          label={<span className={styles.filterLabel}>{t('connections.add-new-connection.category', 'Category')}</span>}
          noMargin
        >
          <ChipSelect
            aria-label={t('connections.add-new-connection.filter-by-category', 'Filter by category')}
            options={categoryFilterOptions}
            selected={state.categoryFilter}
            onChange={handlers.onCategoryFilterChange}
            placeholder={t('connections.add-new-connection.all-categories', 'All categories')}
            addPlaceholder={t('connections.add-new-connection.add-category', 'Add category')}
            listLabel={t('connections.add-new-connection.selected-categories', 'Selected categories')}
          />
        </Field>
      </div>
      {/* Filter by type */}
      <div className={styles.filterField}>
        {state.typeFilter.length > 0 && <div className={styles.activeDot} />}
        <Field
          label={<span className={styles.filterLabel}>{t('connections.add-new-connection.type', 'Type')}</span>}
          noMargin
        >
          <ChipSelect
            aria-label={t('connections.add-new-connection.filter-by-type', 'Filter by type')}
            options={typeFilterOptions}
            selected={state.typeFilter}
            onChange={handlers.onTypeFilterChange}
            placeholder={t('connections.add-new-connection.all-types', 'All types')}
            addPlaceholder={t('connections.add-new-connection.add-type', 'Add type')}
            listLabel={t('connections.add-new-connection.selected-types', 'Selected types')}
          />
        </Field>
      </div>

      {/* Sorting */}
      <div className={styles.filterField}>
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

      <Button
        className={styles.feedbackButton}
        icon="comment-alt-message"
        size="md"
        variant="secondary"
        fill="outline"
        onClick={() =>
          window.open(
            'https://docs.google.com/forms/d/e/1FAIpQLSdsey0TxZXshPWA2rrwcvWBpk-177SquXITFpjH5PAGaOQBew/viewform?usp=dialog',
            '_blank'
          )
        }
      >
        {t('connections.add-new-connection.give-feedback', 'Give feedback')}
      </Button>
    </div>
  );
}
