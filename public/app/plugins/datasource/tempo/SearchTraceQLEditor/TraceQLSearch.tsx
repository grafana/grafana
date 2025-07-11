import { css } from '@emotion/css';
import { useCallback, useEffect, useState } from 'react';

import { CoreApp, GrafanaTheme2, TimeRange } from '@grafana/data';
import { TemporaryAlert } from '@grafana/o11y-ds-frontend';
import { config, FetchError, getTemplateSrv, reportInteraction } from '@grafana/runtime';
import { Alert, Button, Stack, Select, useStyles2 } from '@grafana/ui';

import { RawQuery } from '../_importedDependencies/datasources/prometheus/RawQuery';
import { TraceqlFilter, TraceqlSearchScope } from '../dataquery.gen';
import { TempoDatasource } from '../datasource';
import { TempoQueryBuilderOptions } from '../traceql/TempoQueryBuilderOptions';
import { traceqlGrammar } from '../traceql/traceql';
import { TempoQuery } from '../types';

import { AggregateByAlert } from './AggregateByAlert';
import DurationInput from './DurationInput';
import InlineSearchField from './InlineSearchField';
import SearchField from './SearchField';
import TagsInput from './TagsInput';
import { filterScopedTag, filterTitle, interpolateFilters, replaceAt } from './utils';

interface Props {
  datasource: TempoDatasource;
  query: TempoQuery;
  onChange: (value: TempoQuery) => void;
  onBlur?: () => void;
  onClearResults: () => void;
  app?: CoreApp;
  addVariablesToOptions?: boolean;
  range?: TimeRange;
}

const hardCodedFilterIds = ['min-duration', 'max-duration', 'status'];

const TraceQLSearch = ({
  datasource,
  query,
  onChange,
  onClearResults,
  app,
  addVariablesToOptions = true,
  range,
}: Props) => {
  const styles = useStyles2(getStyles);
  const [alertText, setAlertText] = useState<string>();
  const [error, setError] = useState<Error | FetchError | null>(null);

  const [isTagsLoading, setIsTagsLoading] = useState(true);
  const [traceQlQuery, setTraceQlQuery] = useState<string>('');

  const templateSrv = getTemplateSrv();

  const updateFilter = useCallback(
    (s: TraceqlFilter) => {
      const copy = { ...query };
      copy.filters ||= [];
      const indexOfFilter = copy.filters.findIndex((f) => f.id === s.id);
      if (indexOfFilter >= 0) {
        // update in place if the filter already exists, for consistency and to avoid UI bugs
        copy.filters = replaceAt(copy.filters, indexOfFilter, s);
      } else {
        copy.filters.push(s);
      }
      onChange(copy);
    },
    [onChange, query]
  );

  const deleteFilter = (s: TraceqlFilter) => {
    onChange({ ...query, filters: query.filters.filter((f) => f.id !== s.id) });
  };

  const templateVariables = getTemplateSrv().getVariables();
  useEffect(() => {
    setTraceQlQuery(
      datasource.languageProvider.generateQueryFromFilters({ traceqlFilters: interpolateFilters(query.filters || []) })
    );
  }, [datasource.languageProvider, query, templateVariables]);

  const findFilter = useCallback((id: string) => query.filters?.find((f) => f.id === id), [query.filters]);

  useEffect(() => {
    const fetchTags = async () => {
      try {
        await datasource.languageProvider.start(range, datasource.timeRangeForTags);
        setIsTagsLoading(false);
        setAlertText(undefined);
      } catch (error) {
        if (error instanceof Error) {
          setAlertText(`Error: ${error.message}`);
        }
      }
    };
    fetchTags();
  }, [datasource, setAlertText, range, datasource.timeRangeForTags]);

  useEffect(() => {
    // Initialize state with configured static filters that already have a value from the config
    datasource.search?.filters
      ?.filter((f) => f.value)
      .forEach((f) => {
        if (!findFilter(f.id)) {
          updateFilter(f);
        }
      });
  }, [datasource.search?.filters, findFilter, updateFilter]);

  // filter out tags that already exist in the static fields
  const staticTags = datasource.search?.filters?.map((f) => f.tag) || [];
  staticTags.push('duration');
  staticTags.push('traceDuration');
  staticTags.push('span:duration');
  staticTags.push('trace:duration');
  staticTags.push('status');
  staticTags.push('span:status');

  // Dynamic filters are all filters that don't match the ID of a filter in the datasource configuration
  // The duration and status fields are a special case since its selector is hard-coded
  const dynamicFilters = (query.filters || []).filter(
    (f) =>
      !hardCodedFilterIds.includes(f.id) &&
      (datasource.search?.filters?.findIndex((sf) => sf.id === f.id) || 0) === -1 &&
      f.id !== 'duration-type'
  );

  // We use this function to generate queries without a specfic filter.
  // This is useful because we're sending the query to Tempo so it can return the attributes and values filtered down.
  // However, if we send the full query then we won't see more values for the filter we're trying to edit.
  // For example, if we already have a service.name value selected and try to add another one, we won't see the other
  // values if we send the full query since Tempo will only return the service.name that's already selected.
  const generateQueryWithoutFilter = (filter?: TraceqlFilter) => {
    if (!filter) {
      return traceQlQuery;
    }
    const filtersAfterRemoval = query.filters?.filter((f) => f.id !== filter.id) || [];
    return datasource.languageProvider.generateQueryFromFilters({
      traceqlFilters: interpolateFilters(filtersAfterRemoval || []),
    });
  };

  return (
    <>
      <div className={styles.container}>
        <div>
          {datasource.search?.filters?.map(
            (f) =>
              f.tag && (
                <InlineSearchField
                  key={f.id}
                  label={filterTitle(f, datasource.languageProvider)}
                  tooltip={`Filter your search by ${filterScopedTag(
                    f,
                    datasource.languageProvider
                  )}. To modify the default filters shown for search visit the Tempo datasource configuration page.`}
                >
                  <SearchField
                    filter={findFilter(f.id) || f}
                    datasource={datasource}
                    setError={setError}
                    updateFilter={updateFilter}
                    tags={[]}
                    hideScope={true}
                    hideTag={true}
                    query={generateQueryWithoutFilter(findFilter(f.id))}
                    addVariablesToOptions={addVariablesToOptions}
                    range={range}
                    timeRangeForTags={datasource.timeRangeForTags}
                  />
                </InlineSearchField>
              )
          )}
          <InlineSearchField label={'Status'}>
            <SearchField
              filter={
                findFilter('status') || {
                  id: 'status',
                  tag: 'status',
                  scope: TraceqlSearchScope.Intrinsic,
                  operator: '=',
                }
              }
              datasource={datasource}
              setError={setError}
              updateFilter={updateFilter}
              tags={[]}
              hideScope={true}
              hideTag={true}
              query={generateQueryWithoutFilter(findFilter('status'))}
              isMulti={false}
              allowCustomValue={false}
              addVariablesToOptions={addVariablesToOptions}
              range={range}
              timeRangeForTags={datasource.timeRangeForTags}
            />
          </InlineSearchField>
          <InlineSearchField
            label={'Duration'}
            tooltip="The trace or span duration, i.e. end - start time of the trace/span. Accepted units are ns, ms, s, m, h"
          >
            <Stack gap={0}>
              <Select
                width="auto"
                options={[
                  { label: 'span', value: 'span' },
                  { label: 'trace', value: 'trace' },
                ]}
                value={findFilter('duration-type')?.value ?? 'span'}
                onChange={(v) => {
                  const filter = findFilter('duration-type') || {
                    id: 'duration-type',
                    value: 'span',
                  };
                  updateFilter({ ...filter, value: v?.value });
                }}
                aria-label={'duration type'}
              />
              <DurationInput
                filter={
                  findFilter('min-duration') || {
                    id: 'min-duration',
                    tag: 'duration',
                    operator: '>',
                    valueType: 'duration',
                  }
                }
                operators={['>', '>=']}
                updateFilter={updateFilter}
              />
              <DurationInput
                filter={
                  findFilter('max-duration') || {
                    id: 'max-duration',
                    tag: 'duration',
                    operator: '<',
                    valueType: 'duration',
                  }
                }
                operators={['<', '<=']}
                updateFilter={updateFilter}
              />
            </Stack>
          </InlineSearchField>
          <InlineSearchField label={'Tags'}>
            <TagsInput
              filters={dynamicFilters}
              datasource={datasource}
              setError={setError}
              updateFilter={updateFilter}
              deleteFilter={deleteFilter}
              staticTags={staticTags}
              isTagsLoading={isTagsLoading}
              generateQueryWithoutFilter={generateQueryWithoutFilter}
              requireTagAndValue={true}
              addVariablesToOptions={addVariablesToOptions}
              range={range}
              timeRangeForTags={datasource.timeRangeForTags}
            />
          </InlineSearchField>
          <AggregateByAlert
            query={query}
            onChange={() => {
              delete query.groupBy;
              onChange({
                ...query,
              });
            }}
          />
        </div>
        <div className={styles.rawQueryContainer}>
          <RawQuery query={templateSrv.replace(traceQlQuery)} lang={{ grammar: traceqlGrammar, name: 'traceql' }} />
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              reportInteraction('grafana_traces_copy_to_traceql_clicked', {
                app: app ?? '',
                grafana_version: config.buildInfo.version,
                location: 'search_tab',
              });

              onClearResults();
              const traceQlQuery = datasource.languageProvider.generateQueryFromFilters({
                traceqlFilters: query.filters || [],
              });
              onChange({
                ...query,
                query: traceQlQuery,
                queryType: 'traceql',
              });
            }}
          >
            Edit in TraceQL
          </Button>
        </div>
        <TempoQueryBuilderOptions
          onChange={onChange}
          query={query}
          searchStreaming={datasource.isStreamingSearchEnabled() ?? false}
          metricsStreaming={datasource.isStreamingMetricsEnabled() ?? false}
          app={app}
        />
      </div>
      {error ? (
        <Alert title="Unable to connect to Tempo search" severity="info" className={styles.alert}>
          Please ensure that Tempo is configured with search enabled. If you would like to hide this tab, you can
          configure it in the <a href={`/datasources/edit/${datasource.uid}`}>datasource settings</a>.
        </Alert>
      ) : null}
      {alertText && <TemporaryAlert severity={'error'} text={alertText} />}
    </>
  );
};

export default TraceQLSearch;

const getStyles = (theme: GrafanaTheme2) => ({
  alert: css({
    maxWidth: '75ch',
    marginTop: theme.spacing(2),
  }),
  container: css({
    display: 'flex',
    gap: '4px',
    flexWrap: 'wrap',
    flexDirection: 'column',
  }),
  rawQueryContainer: css({
    alignItems: 'center',
    backgroundColor: theme.colors.background.secondary,
    display: 'flex',
    justifyContent: 'space-between',
    padding: theme.spacing(1),
  }),
});
