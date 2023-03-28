import { css } from '@emotion/css';
import React, { useEffect, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { EditorRow } from '@grafana/experimental';
import { FetchError } from '@grafana/runtime';
import { Alert, HorizontalGroup, useStyles2 } from '@grafana/ui';

import { createErrorNotification } from '../../../../core/copy/appNotification';
import { notifyApp } from '../../../../core/reducers/appNotification';
import { dispatch } from '../../../../store/store';
import { RawQuery } from '../../prometheus/querybuilder/shared/RawQuery';
import { TraceqlFilter, TraceqlSearchScope } from '../dataquery.gen';
import { TempoDatasource } from '../datasource';
import { TempoQueryBuilderOptions } from '../traceql/TempoQueryBuilderOptions';
import { CompletionProvider } from '../traceql/autocomplete';
import { traceqlGrammar } from '../traceql/traceql';
import { TempoQuery } from '../types';

import DurationInput from './DurationInput';
import InlineSearchField from './InlineSearchField';
import SearchField from './SearchField';
import TagsInput from './TagsInput';
import { generateQueryFromFilters, replaceAt } from './utils';

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

  const updateFilter = (s: TraceqlFilter) => {
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
  };

  const deleteFilter = (s: TraceqlFilter) => {
    onChange({ ...query, filters: query.filters.filter((f) => f.id !== s.id) });
  };

  useEffect(() => {
    setTraceQlQuery(generateQueryFromFilters(query.filters || []));
  }, [query]);

  const findFilter = (id: string) => query.filters?.find((f) => f.id === id);

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

  return (
    <>
      <div className={styles.container}>
        <div>
          <InlineSearchField label={'Service Name'}>
            <SearchField
              filter={
                findFilter('service-name') || {
                  id: 'service-name',
                  type: 'static',
                  tag: 'service.name',
                  operator: '=',
                  scope: TraceqlSearchScope.Resource,
                }
              }
              datasource={datasource}
              setError={setError}
              updateFilter={updateFilter}
              tags={[]}
            />
          </InlineSearchField>
          <InlineSearchField label={'Span Name'}>
            <SearchField
              filter={findFilter('span-name') || { id: 'span-name', type: 'static', tag: 'name', operator: '=' }}
              datasource={datasource}
              setError={setError}
              updateFilter={updateFilter}
              tags={[]}
            />
          </InlineSearchField>
          <InlineSearchField label={'Duration'} tooltip="The span duration, i.e.	end - start time of the span">
            <HorizontalGroup spacing={'sm'}>
              <DurationInput
                filter={
                  findFilter('min-duration') || {
                    id: 'min-duration',
                    type: 'static',
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
                    type: 'static',
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
              filters={query.filters}
              datasource={datasource}
              setError={setError}
              updateFilter={updateFilter}
              deleteFilter={deleteFilter}
              tags={[...CompletionProvider.intrinsics, ...tags]}
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
