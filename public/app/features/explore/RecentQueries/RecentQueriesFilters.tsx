import { css, cx } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import {
  Button,
  Divider,
  FilterInput,
  InlineSwitch,
  Label,
  MultiCombobox,
  RadioButtonGroup,
  Stack,
  Text,
  useStyles2,
} from '@grafana/ui';
import { SortPicker } from 'app/core/components/Select/SortPicker';

import { getRecentQueriesSortOptions } from './recentQueriesSortOptions';
import { type RecentQueriesFilterState } from './useRecentQueriesData';

const SEARCH_ID = 'recent-queries-search';
const DATASOURCE_FILTER_ID = 'recent-queries-datasource-filter';

type Props = {
  filters: RecentQueriesFilterState;
  setFilters: (update: Partial<RecentQueriesFilterState>) => void;
  availableDatasources: string[];
  onClear: () => void;
  showStarredFilter?: boolean;
  disabled?: boolean;
  onAnalyticsEvent?: (event: string, properties?: Record<string, string | boolean | undefined>) => void;
};

export function RecentQueriesFilters({
  filters,
  setFilters,
  availableDatasources,
  onClear,
  showStarredFilter,
  disabled,
  onAnalyticsEvent,
}: Props) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.filters} role="region" aria-label={t('recent-queries.filters.panel-label', 'Filters')}>
      <fieldset disabled={Boolean(disabled)} className={styles.fieldset}>
        <Stack direction="column" gap={2}>
          {/* Header row: "Filters" label + "Clear" link */}
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Text variant="body" weight="medium">
              {t('recent-queries.filters.header', 'Filters')}
            </Text>
            <Button variant="secondary" fill="text" size="sm" onClick={onClear} disabled={disabled}>
              {t('recent-queries.filters.clear', 'Clear')}
            </Button>
          </Stack>

          <Divider spacing={0} />

          {/* Group 1: Starred toggle (when star is available) + Search */}
          <Stack direction="column" gap={1}>
            {showStarredFilter && (
              <Stack direction="column" gap={0}>
                <Label>{t('recent-queries.filters.starred-label', 'Starred queries')}</Label>
                <RadioButtonGroup
                  options={[
                    { value: false, label: t('recent-queries.filters.all-queries', 'All queries') },
                    { value: true, label: t('recent-queries.filters.starred', 'Starred queries') },
                  ]}
                  value={filters.showStarredOnly}
                  onChange={(value) => {
                    onAnalyticsEvent?.('starredFilterChanged', { showStarredOnly: value });
                    setFilters({ showStarredOnly: value });
                  }}
                  aria-label={t('recent-queries.filters.starred-label', 'Starred queries')}
                  fullWidth
                  disabled={disabled}
                />
              </Stack>
            )}
            <Stack direction="column" gap={0}>
              <Label htmlFor={SEARCH_ID}>{t('recent-queries.filters.search-label', 'Search')}</Label>
              <FilterInput
                id={SEARCH_ID}
                value={filters.searchQuery}
                onChange={(value) => setFilters({ searchQuery: value })}
                onFocus={() => onAnalyticsEvent?.('searchBarFocused')}
                placeholder={t('recent-queries.filters.search-placeholder', 'Search by...')}
                disabled={disabled}
                escapeRegex={false}
              />
            </Stack>
          </Stack>

          <Divider spacing={0} />

          {/* Group 2: Datasource */}
          <Stack direction="column" gap={0}>
            <Label htmlFor={DATASOURCE_FILTER_ID}>
              {t('recent-queries.filters.datasource-label', 'Data source name')}
            </Label>
            <div className={cx(styles.controlWrapper, styles.comboboxWrapper)}>
              <MultiCombobox
                id={DATASOURCE_FILTER_ID}
                options={availableDatasources.map((ds) => ({ value: ds, label: ds }))}
                value={filters.datasourceFilters}
                onChange={(selected) => {
                  onAnalyticsEvent?.('dataSourceFilterChanged');
                  setFilters({ datasourceFilters: selected.map((o) => o.value) });
                }}
                placeholder={t('recent-queries.filters.datasource-placeholder', 'Select data source name')}
                disabled={disabled}
              />
            </div>
          </Stack>

          <Divider spacing={0} />

          {/* Group 3: Sort */}
          <Stack direction="column" gap={0}>
            <Label>{t('recent-queries.filters.sort-label', 'Sort')}</Label>
            <div className={styles.controlWrapper}>
              <SortPicker
                value={filters.sortingOption?.value}
                onChange={(change) => {
                  onAnalyticsEvent?.('sortingOptionChanged', { value: change.value });
                  setFilters({ sortingOption: change });
                }}
                getSortOptions={getRecentQueriesSortOptions}
                placeholder={t('recent-queries.filters.sort-placeholder', 'Sort Newest')}
                disabled={disabled}
              />
            </div>
          </Stack>

          <Divider spacing={0} />

          {/* Remember filters toggle */}
          <Stack direction="column" gap={0.5}>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Label htmlFor="remember-filters-toggle">
                {t('recent-queries.filters.remember-filters-label', 'Remember filters')}
              </Label>
              <InlineSwitch
                id="remember-filters-toggle"
                transparent={true}
                className={styles.inlineSwitch}
                value={filters.rememberFilters}
                onChange={(e) => {
                  onAnalyticsEvent?.('rememberFiltersToggled', { rememberFilters: e.currentTarget.checked });
                  setFilters({ rememberFilters: e.currentTarget.checked });
                }}
                aria-describedby="remember-filters-subtext"
                disabled={disabled}
              />
            </Stack>
            <span id="remember-filters-subtext" className={styles.subtext}>
              {t('recent-queries.filters.remember-filters-subtext', 'Your settings restore on next visit')}
            </span>
          </Stack>
        </Stack>
      </fieldset>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  fieldset: css({ border: 'none', padding: 0, margin: 0 }),
  filters: css({
    width: '290px',
    flexShrink: 0,
    padding: theme.spacing(2),
    paddingTop: 0,
    overflowY: 'auto',
    paddingRight: theme.spacing(2),
  }),
  subtext: css({
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.secondary,
  }),
  inlineSwitch: css({
    height: theme.spacing(2),
    padding: 0,
  }),
  controlWrapper: css({
    width: '100%',
    '& > div': {
      width: '100% !important',
    },
  }),
  comboboxWrapper: css({
    '& input[disabled]': {
      backgroundColor: 'transparent',
    },
  }),
});
