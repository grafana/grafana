import { useCallback, useEffect } from 'react';
import useAsync from 'react-use/lib/useAsync';

import { DataSourcePluginOptionsEditorProps, updateDatasourcePluginJsonDataOption } from '@grafana/data';
import { Alert } from '@grafana/ui';

import TagsInput from '../SearchTraceQLEditor/TagsInput';
import { replaceAt } from '../SearchTraceQLEditor/utils';
import { TraceqlFilter, TraceqlSearchScope } from '../dataquery.gen';
import { TempoDatasource } from '../datasource';
import { TempoJsonData } from '../types';
import { getErrorMessage } from '../utils';

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
    } catch (err) {
      // @ts-ignore
      throw new Error(getErrorMessage(err.data.message, 'Unable to query Tempo'));
    }
  };

  const { error, loading } = useAsync(fetchTags, [datasource, options]);

  const updateFilter = useCallback(
    (s: TraceqlFilter) => {
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
            tag: 'service.name',
            operator: '=',
            scope: TraceqlSearchScope.Resource,
          },
          { id: 'span-name', tag: 'name', operator: '=', scope: TraceqlSearchScope.Span },
        ],
      });
    }
  }, [onOptionsChange, options]);

  // filter out tags that already exist in TraceQLSearch editor
  const staticTags = ['duration'];

  const missingTag = options.jsonData.search?.filters?.find((f) => !f.tag);

  return (
    <>
      {datasource ? (
        <TagsInput
          updateFilter={updateFilter}
          deleteFilter={deleteFilter}
          filters={options.jsonData.search?.filters || []}
          datasource={datasource}
          setError={() => {}}
          staticTags={staticTags}
          isTagsLoading={loading}
          hideValues={true}
          generateQueryWithoutFilter={() => '{}'}
        />
      ) : (
        <div>Invalid data source, please create a valid data source and try again</div>
      )}
      {error && (
        <Alert title={'Unable to fetch TraceQL tags'} severity={'error'} topSpacing={1}>
          {error.message}
        </Alert>
      )}
      {missingTag && (
        <Alert title={'Please ensure each filter has a selected tag'} severity={'warning'} topSpacing={1}></Alert>
      )}
    </>
  );
}
