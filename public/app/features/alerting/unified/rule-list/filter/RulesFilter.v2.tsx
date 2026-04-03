import { css } from '@emotion/css';
import { useCallback, useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Box, FilterInput, Icon, Label, Stack, useStyles2 } from '@grafana/ui';

import { trackAlertRuleFilterEvent, trackRulesSearchInputCleared } from '../../Analytics';
import { PopupCard } from '../../components/HoverCard';
import { RulesViewModeSelector, type SupportedView } from '../../components/rules/Filter/RulesViewModeSelector';
import { SavedSearches } from '../../components/saved-searches/SavedSearches';
import { type SavedSearch } from '../../components/saved-searches/savedSearchesSchema';
import { useRulesFilter } from '../../hooks/useFilteredRules';
import { getSearchFilterFromQuery } from '../../search/rulesSearchParser';

import { trackSavedSearchApplied, useSavedSearches } from './useSavedSearches';

export interface RulesFilterProps {
  viewMode?: SupportedView;
  onViewModeChange?: (viewMode: SupportedView) => void;
}

type SearchQueryForm = {
  query: string;
};

export default function RulesFilter({ viewMode, onViewModeChange }: RulesFilterProps) {
  const { searchQuery, updateFilters } = useRulesFilter();

  const {
    savedSearches,
    isLoading: savedSearchesLoading,
    saveSearch,
    renameSearch,
    deleteSearch,
    setDefaultSearch,
  } = useSavedSearches();

  const { control, setValue, handleSubmit } = useForm<SearchQueryForm>({
    defaultValues: {
      query: searchQuery,
    },
  });

  useEffect(() => {
    setValue('query', searchQuery);
  }, [searchQuery, setValue]);

  const handleApplySearch = useCallback(
    (search: SavedSearch) => {
      const parsedFilter = getSearchFilterFromQuery(search.query);
      updateFilters(parsedFilter);
      trackSavedSearchApplied(search);
    },
    [updateFilters]
  );

  const submitHandler = (values: SearchQueryForm) => {
    const parsedFilter = getSearchFilterFromQuery(values.query);
    trackAlertRuleFilterEvent({ filterMethod: 'search-input', filter: parsedFilter, filterVariant: 'v2' });
    updateFilters(parsedFilter);
  };

  return (
    <form onSubmit={handleSubmit(submitHandler)} onReset={() => {}}>
      <Stack direction="column" gap={1}>
        <Label htmlFor="rulesSearchInput">
          <Stack gap={0.5} alignItems="center">
            <span>
              <Trans i18nKey="alerting.rules-filter.search">Search</Trans>
            </span>
            <PopupCard content={<SearchQueryHelp />}>
              <Icon
                name="info-circle"
                size="sm"
                tabIndex={0}
                title={t('alerting.rules-filter.title-search-help', 'Search help')}
              />
            </PopupCard>
          </Stack>
        </Label>
        <Stack direction="row" alignItems="center" gap={1}>
          <Box flex={1}>
            <Controller
              name="query"
              control={control}
              render={({ field }) => (
                <FilterInput
                  id="rulesSearchInput"
                  data-testid="search-query-input"
                  placeholder={t(
                    'alerting.rules-filter.filter-options.placeholder-search-input',
                    'Search by name or enter filter query...'
                  )}
                  name="searchQuery"
                  escapeRegex={false}
                  onChange={(next) => {
                    trackRulesSearchInputCleared(field.value, next);
                    field.onChange(next);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === 'NumpadEnter') {
                      event.preventDefault();
                      handleSubmit(submitHandler)();
                    }
                  }}
                  onBlur={() => {
                    const currentQuery = field.value;
                    const parsedFilter = getSearchFilterFromQuery(currentQuery);
                    trackAlertRuleFilterEvent({
                      filterMethod: 'search-input',
                      filter: parsedFilter,
                      filterVariant: 'v2',
                    });
                    updateFilters(parsedFilter);
                  }}
                  value={field.value}
                />
              )}
            />
          </Box>
          <SavedSearches
            savedSearches={savedSearches}
            currentSearchQuery={searchQuery}
            onSave={saveSearch}
            onRename={renameSearch}
            onDelete={deleteSearch}
            onApply={handleApplySearch}
            onSetDefault={setDefaultSearch}
            isLoading={savedSearchesLoading}
          />
          <RulesViewModeSelector viewMode={viewMode} onViewModeChange={onViewModeChange} />
        </Stack>
      </Stack>
    </form>
  );
}

function SearchQueryHelp() {
  const styles = useStyles2(helpStyles);

  return (
    <div>
      <div>
        <Trans i18nKey="alerting.search-query-help.search-syntax">
          Search syntax allows to query alert rules by the parameters defined below.
        </Trans>
      </div>
      <hr />
      <div className={styles.grid}>
        <div>
          <Trans i18nKey="alerting.search-query-help.filter-type">Filter type</Trans>
        </div>
        <div>
          <Trans i18nKey="alerting.search-query-help.expression">Expression</Trans>
        </div>
        <HelpRow
          title={t('alerting.search-query-help.title-datasources', 'Datasources')}
          expr="datasource:mimir datasource:prometheus"
        />
        <HelpRow
          title={t('alerting.search-query-help.title-folder-namespace', 'Folder/Namespace')}
          expr="namespace:global"
        />
        <HelpRow title={t('alerting.search-query-help.title-group', 'Group')} expr="group:cpu-usage" />
        <HelpRow title={t('alerting.search-query-help.title-rule', 'Rule')} expr='rule:"cpu 80%"' />
        <HelpRow
          title={t('alerting.search-query-help.title-labels', 'Labels')}
          expr='label:team=A label:"cluster=new york"'
        />
        <HelpRow
          title={t('alerting.search-query-help.title-state', 'State')}
          expr="state:firing|normal|pending|recovering"
        />
        <HelpRow title={t('alerting.search-query-help.title-type', 'Type')} expr="type:alerting|recording" />
        <HelpRow title={t('alerting.search-query-help.title-health', 'Health')} expr="health:ok|nodata|error" />
        <HelpRow
          title={t('alerting.search-query-help.title-dashboard-uid', 'Dashboard UID')}
          expr="dashboard:eadde4c7-54e6-4964-85c0-484ab852fd04"
        />
        <HelpRow
          title={t('alerting.search-query-help.title-contact-point', 'Contact point')}
          expr="contactPoint:slack"
        />
        <HelpRow title={t('alerting.search-query-help.title-policy', 'Policy')} expr="policy:team-a-policy" />
      </div>
    </div>
  );
}

function HelpRow({ title, expr }: { title: string; expr: string }) {
  const styles = useStyles2(helpStyles);

  return (
    <>
      <div>{title}</div>
      <code className={styles.code}>{expr}</code>
    </>
  );
}

const helpStyles = (theme: GrafanaTheme2) => ({
  grid: css({
    display: 'grid',
    gridTemplateColumns: 'max-content auto',
    gap: theme.spacing(1),
    alignItems: 'center',
  }),
  code: css({
    display: 'block',
    textAlign: 'center',
  }),
});
