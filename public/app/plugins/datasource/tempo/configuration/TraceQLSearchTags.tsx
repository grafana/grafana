import React, { useCallback, useEffect } from 'react';
import useAsync from 'react-use/lib/useAsync';

import { DataSourcePluginOptionsEditorProps, updateDatasourcePluginJsonDataOption } from '@grafana/data';
import { Alert } from '@grafana/ui';

import TagsInput from '../SearchTraceQLEditor/TagsInput';
import { replaceAt } from '../SearchTraceQLEditor/utils';
import { TraceqlFilter, TraceqlSearchScope } from '../dataquery.gen';
import { TempoDatasource } from '../datasource';
import { CompletionProvider } from '../traceql/autocomplete';
import { TempoJsonData } from '../types';

interface Props extends DataSourcePluginOptionsEditorProps<TempoJsonData> {
  datasource?: TempoDatasource;
}

export function TraceQLSearchTags({ options, onOptionsChange, datasource }: Props) {
  const fetchTags = async () => {
    if (!datasource) {
      throw new Error('Unable to retrieve datasource');
    }

    try {
      await datasource.languageProvider.start();
      const tags = datasource.languageProvider.getTags();

      if (tags) {
        // This is needed because the /api/v2/search/tag/${tag}/values API expects "status" and the v1 API expects "status.code"
        // so Tempo doesn't send anything and we inject it here for the autocomplete
        if (!tags.find((t) => t === 'status')) {
          tags.push('status');
        }
        return tags;
      }
    } catch (e) {
      // @ts-ignore
      throw new Error(`${e.statusText}: ${e.data.error}`);
    }
    return [];
  };

  const { error, loading, value: tags } = useAsync(fetchTags, [datasource, options]);

  const updateFilter = useCallback(
    (s: TraceqlFilter) => {
      // All configured fields are typed as static
      s.type = 'static';

      let copy = options.jsonData.search?.filters;
      copy ||= [];
      const indexOfFilter = copy.findIndex((f) => f.id === s.id);
      if (indexOfFilter >= 0) {
        // update in place if the filter already exists, for consistency and to avoid UI bugs
        copy = replaceAt(copy, indexOfFilter, s);
      } else {
        copy.push(s);
      }
      updateDatasourcePluginJsonDataOption({ onOptionsChange, options }, 'search', {
        ...options.jsonData.search,
        filters: copy,
      });
    },
    [onOptionsChange, options]
  );

  const deleteFilter = (s: TraceqlFilter) => {
    updateDatasourcePluginJsonDataOption({ onOptionsChange, options }, 'search', {
      ...options.jsonData.search,
      filters: options.jsonData.search?.filters?.filter((f) => f.id !== s.id),
    });
  };

  useEffect(() => {
    if (!options.jsonData.search?.filters) {
      updateDatasourcePluginJsonDataOption({ onOptionsChange, options }, 'search', {
        ...options.jsonData.search,
        filters: [
          {
            id: 'service-name',
            type: 'static',
            tag: 'service.name',
            operator: '=',
            scope: TraceqlSearchScope.Resource,
          },
          { id: 'span-name', type: 'static', tag: 'name', operator: '=', scope: TraceqlSearchScope.Span },
        ],
      });
    }
  }, [onOptionsChange, options]);

  return (
    <>
      {datasource ? (
        <TagsInput
          updateFilter={updateFilter}
          deleteFilter={deleteFilter}
          filters={options.jsonData.search?.filters || []}
          datasource={datasource}
          setError={() => {}}
          tags={[...CompletionProvider.intrinsics, ...(tags || [])]}
          isTagsLoading={loading}
        />
      ) : (
        <div>Invalid data source, please create a valid data source and try again</div>
      )}
      {error && (
        <Alert title={'Unable to fetch TraceQL tags'} severity={'error'} topSpacing={1}>
          {error.message}
        </Alert>
      )}
    </>
  );
}
