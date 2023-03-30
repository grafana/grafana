import { css } from '@emotion/css';
import React, { useCallback, useEffect, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { EditorRow } from '@grafana/experimental';
import { FetchError } from '@grafana/runtime';
import { Alert, HorizontalGroup, useStyles2 } from '@grafana/ui';

import { createErrorNotification } from '../../../../core/copy/appNotification';
import { notifyApp } from '../../../../core/reducers/appNotification';
import { dispatch } from '../../../../store/store';
import { RawQuery } from '../../prometheus/querybuilder/shared/RawQuery';
import { TraceqlFilter } from '../dataquery.gen';
import { TempoDatasource } from '../datasource';
import { TempoQueryBuilderOptions } from '../traceql/TempoQueryBuilderOptions';
import { CompletionProvider } from '../traceql/autocomplete';
import { traceqlGrammar } from '../traceql/traceql';
import { TempoQuery } from '../types';

import DurationInput from './DurationInput';
import InlineSearchField from './InlineSearchField';
import SearchField from './SearchField';
import TagsInput from './TagsInput';
import { filterScopedTag, filterTitle, generateQueryFromFilters, replaceAt } from './utils';

interface Props {
  datasource: TempoDatasource;
  query: TempoQuery;
  onChange: (value: TempoQuery) => void;
  onBlur?: () => void;
}

const TraceQLSearch = ({ datasource, query, onChange }: Props) => {
  const styles = useStyles2(getStyles);
  const [error, setError] = useState<Error | FetchError | null>(null);

  const [tags, setTags] = useState<string[]>([]);
  const [isTagsLoading, setIsTagsLoading] = useState(true);
  const [traceQlQuery, setTraceQlQuery] = useState<string>('');

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

  useEffect(() => {
    setTraceQlQuery(generateQueryFromFilters(query.filters || []));
  }, [query]);

  const findFilter = useCallback((id: string) => query.filters?.find((f) => f.id === id), [query.filters]);

  useEffect(() => {
    const fetchTags = async () => {
      try {
        await datasource.languageProvider.start();
        const tags = datasource.languageProvider.getTags();

        if (tags) {
          // This is needed because the /api/v2/search/tag/${tag}/values API expects "status" and the v1 API expects "status.code"
          // so Tempo doesn't send anything and we inject it here for the autocomplete
          if (!tags.find((t) => t === 'status')) {
            tags.push('status');
          }
          setTags(tags);
          setIsTagsLoading(false);
        }
      } catch (error) {
        if (error instanceof Error) {
          dispatch(notifyApp(createErrorNotification('Error', error)));
        }
      }
    };
    fetchTags();
  }, [datasource]);

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
  const filteredTags = [...CompletionProvider.intrinsics, ...tags].filter((t) => !staticTags.includes(t));

  // Dynamic filters are all filters that don't match the ID of a filter in the datasource configuration
  // The duration tag is a special case since its selector is hard-coded
  const dynamicFilters = (query.filters || []).filter(
    (f) => f.tag !== 'duration' && (datasource.search?.filters?.findIndex((sf) => sf.id === f.id) || 0) === -1
  );

  return (
    <>
      <div className={styles.container}>
        <div>
          {datasource.search?.filters?.map((f) => (
            <InlineSearchField
              key={f.id}
              label={filterTitle(f)}
              tooltip={`Configured in datasource - ${filterScopedTag(f)}`}
            >
              <SearchField
                filter={findFilter(f.id) || f}
                datasource={datasource}
                setError={setError}
                updateFilter={updateFilter}
                tags={[]}
                hideScope={true}
                hideTag={true}
              />
            </InlineSearchField>
          ))}
          <InlineSearchField
            label={'Duration'}
            tooltip="The span duration, i.e.	end - start time of the span. Accepted units are ns, ms, s, m, h"
          >
            <HorizontalGroup spacing={'sm'}>
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
            </HorizontalGroup>
          </InlineSearchField>
          <InlineSearchField label={'Tags'}>
            <TagsInput
              filters={dynamicFilters}
              datasource={datasource}
              setError={setError}
              updateFilter={updateFilter}
              deleteFilter={deleteFilter}
              tags={filteredTags}
              isTagsLoading={isTagsLoading}
            />
          </InlineSearchField>
        </div>
        <EditorRow>
          <RawQuery query={traceQlQuery} lang={{ grammar: traceqlGrammar, name: 'traceql' }} />
        </EditorRow>
        <TempoQueryBuilderOptions onChange={onChange} query={query} />
      </div>
      {error ? (
        <Alert title="Unable to connect to Tempo search" severity="info" className={styles.alert}>
          Please ensure that Tempo is configured with search enabled. If you would like to hide this tab, you can
          configure it in the <a href={`/datasources/edit/${datasource.uid}`}>datasource settings</a>.
        </Alert>
      ) : null}
    </>
  );
};

export default TraceQLSearch;

const getStyles = (theme: GrafanaTheme2) => ({
  alert: css`
    max-width: 75ch;
    margin-top: ${theme.spacing(2)};
  `,
  container: css`
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
    flex-direction: column;
  `,
});
