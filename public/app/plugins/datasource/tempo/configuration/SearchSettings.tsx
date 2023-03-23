import { css } from '@emotion/css';
import React, { useCallback, useEffect, useState } from 'react';

import { DataSourcePluginOptionsEditorProps, updateDatasourcePluginJsonDataOption } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { InlineField, InlineFieldRow, InlineSwitch } from '@grafana/ui';

import { createErrorNotification } from '../../../../core/copy/appNotification';
import { notifyApp } from '../../../../core/reducers/appNotification';
import { dispatch } from '../../../../store/store';
import TagsInput from '../SearchTraceQLEditor/TagsInput';
import { replaceAt } from '../SearchTraceQLEditor/utils';
import { TraceqlFilter, TraceqlSearchScope } from '../dataquery.gen';
import { TempoDatasource } from '../datasource';
import { CompletionProvider } from '../traceql/autocomplete';
import { TempoJsonData } from '../types';

interface Props extends DataSourcePluginOptionsEditorProps<TempoJsonData> {}

export function SearchSettings({ options, onOptionsChange }: Props) {
  const [tags, setTags] = useState<string[]>([]);
  const [isTagsLoading, setIsTagsLoading] = useState(true);
  const [datasource, setDatasource] = useState<TempoDatasource | undefined>();

  const dataSourceSrv = getDataSourceSrv();
  useEffect(() => {
    const fetchDatasource = async () => {
      setDatasource((await dataSourceSrv.get({ type: options.type, uid: options.uid })) as TempoDatasource);
    };
    fetchDatasource();
  }, [dataSourceSrv, options.type, options.uid]);

  useEffect(() => {
    const fetchTags = async () => {
      try {
        if (datasource) {
          await datasource.languageProvider.start();
          const tags = datasource.languageProvider.getTags();

          if (tags) {
            // This is needed because the /api/v2/search/tag/${tag}/values API expects "status" and the v1 API expects "status.code"
            // so Tempo doesn't send anything and we inject it here for the autocomplete
            if (!tags.find((t) => t === 'status')) {
              tags.push('status');
            }
            setTags(tags);
          }
        }
      } catch (error) {
        if (error instanceof Error) {
          dispatch(notifyApp(createErrorNotification('Error', error)));
        }
      } finally {
        setIsTagsLoading(false);
      }
    };
    fetchTags();
  }, [datasource]);

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
    <div className={styles.container}>
      <h3 className="page-heading">Tempo search</h3>
      <InlineFieldRow className={styles.row}>
        <InlineField tooltip="Removes the search tab from the query editor" label="Hide search" labelWidth={26}>
          <InlineSwitch
            id="hideSearch"
            value={options.jsonData.search?.hide}
            onChange={(event: React.SyntheticEvent<HTMLInputElement>) =>
              updateDatasourcePluginJsonDataOption({ onOptionsChange, options }, 'search', {
                ...options.jsonData.search,
                hide: event.currentTarget.checked,
              })
            }
          />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow className={styles.row}>
        <InlineField tooltip="Configures which fields are available in the UI" label="Static filters" labelWidth={26}>
          {datasource ? (
            <TagsInput
              updateFilter={updateFilter}
              deleteFilter={deleteFilter}
              filters={options.jsonData.search?.filters || []}
              datasource={datasource}
              setError={() => {}}
              tags={[...CompletionProvider.intrinsics, ...tags]}
              isTagsLoading={isTagsLoading}
            />
          ) : (
            <div>Invalid data source, please create a valid data source and try again</div>
          )}
        </InlineField>
      </InlineFieldRow>
    </div>
  );
}

const styles = {
  container: css`
    label: container;
    width: 100%;
  `,
  row: css`
    label: row;
    align-items: baseline;
  `,
};
