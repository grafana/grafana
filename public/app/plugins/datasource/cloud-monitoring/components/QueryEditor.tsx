import deepEqual from 'fast-deep-equal';
import { isEqual } from 'lodash';
import { useEffect, useState } from 'react';

import { QueryEditorProps, getDefaultTimeRange, toOption } from '@grafana/data';
import { EditorRows } from '@grafana/plugin-ui';
import { ConfirmModal } from '@grafana/ui';

import CloudMonitoringDatasource from '../datasource';
import { selectors } from '../e2e/selectors';
import { CloudMonitoringQuery, PromQLQuery, QueryType, SLOQuery } from '../types/query';
import { CloudMonitoringOptions } from '../types/types';

import { defaultTimeSeriesList, defaultTimeSeriesQuery } from './MetricQueryEditor';
import { PromQLQueryEditor } from './PromQLEditor';
import { QueryHeader } from './QueryHeader';
import { defaultQuery as defaultSLOQuery } from './SLOQueryEditor';

import { MetricQueryEditor, SLOQueryEditor } from './';

export type Props = QueryEditorProps<CloudMonitoringDatasource, CloudMonitoringQuery, CloudMonitoringOptions>;

export const QueryEditor = (props: Props) => {
  const { datasource, query, onRunQuery, onChange, range } = props;
  const [modalIsOpen, setModalIsOpen] = useState<boolean>(false);

  useEffect(() => {
    const migrated = datasource.migrateQuery(query);
    if (!deepEqual(migrated, query)) {
      onChange({ ...migrated });
    }
  }, [query, datasource, onChange]);

  const [currentQuery, setCurrentQuery] = useState<CloudMonitoringQuery>(query);
  const [queryHasBeenEdited, setQueryHasBeenEdited] = useState<boolean>(false);

  const sloQuery = { ...defaultSLOQuery(datasource), ...query.sloQuery };
  const onSLOQueryChange = (q: SLOQuery) => {
    onChange({ ...query, sloQuery: q });
    onRunQuery();
  };

  const promQLQuery = {
    ...{ projectName: datasource.getDefaultProject(), expr: '', step: '10s' },
    ...query.promQLQuery,
  };
  const onPromQLQueryChange = (q: PromQLQuery) => {
    onChange({ ...query, promQLQuery: q });
  };

  const onMetricQueryChange = (q: CloudMonitoringQuery) => {
    if (
      (q.queryType === QueryType.TIME_SERIES_LIST && !isEqual(q.timeSeriesList, defaultTimeSeriesList(datasource))) ||
      (q.queryType === QueryType.TIME_SERIES_QUERY && !isEqual(q.timeSeriesQuery, defaultTimeSeriesQuery(datasource)))
    ) {
      setQueryHasBeenEdited(true);
    }
    onChange(q);
  };

  const meta = props.data?.series.length ? props.data?.series[0].meta : {};
  const customMetaData = meta?.custom ?? {};
  const variableOptionGroup = {
    label: 'Template Variables',
    expanded: false,
    options: datasource.getVariables().map(toOption),
  };

  // Use a known query type
  useEffect(() => {
    if (!query.queryType || !Object.values(QueryType).includes(query.queryType)) {
      onChange({ ...query, queryType: QueryType.TIME_SERIES_LIST });
    }
  });
  const queryType = query.queryType;

  const checkForModalDisplay = (q: CloudMonitoringQuery) => {
    if (
      queryHasBeenEdited &&
      (currentQuery.queryType === QueryType.TIME_SERIES_LIST || currentQuery.queryType === QueryType.TIME_SERIES_QUERY)
    ) {
      if (currentQuery.queryType !== q.queryType) {
        setModalIsOpen(true);
      }
    } else {
      onChange(q);
    }
    setCurrentQuery(q);
  };

  return (
    <span data-testid={selectors.components.queryEditor.container}>
      <EditorRows>
        <ConfirmModal
          data-testid="switch-query-type-modal"
          title="Warning"
          body="By switching your query type, your current query will be lost."
          isOpen={modalIsOpen}
          onConfirm={() => {
            setModalIsOpen(false);
            onChange(currentQuery);
            setQueryHasBeenEdited(false);
          }}
          confirmText="Confirm"
          onDismiss={() => {
            setModalIsOpen(false);
            setCurrentQuery(query);
          }}
        />
        <QueryHeader query={query} onChange={checkForModalDisplay} onRunQuery={onRunQuery} />

        {queryType === QueryType.PROMQL && (
          <PromQLQueryEditor
            refId={query.refId}
            variableOptionGroup={variableOptionGroup}
            onChange={onPromQLQueryChange}
            onRunQuery={onRunQuery}
            datasource={datasource}
            query={promQLQuery}
          />
        )}

        {queryType !== QueryType.SLO && (
          <MetricQueryEditor
            refId={query.refId}
            variableOptionGroup={variableOptionGroup}
            customMetaData={customMetaData}
            onChange={onMetricQueryChange}
            onRunQuery={onRunQuery}
            datasource={datasource}
            query={query}
            range={range || getDefaultTimeRange()}
          />
        )}

        {queryType === QueryType.SLO && (
          <SLOQueryEditor
            refId={query.refId}
            variableOptionGroup={variableOptionGroup}
            customMetaData={customMetaData}
            onChange={onSLOQueryChange}
            onRunQuery={onRunQuery}
            datasource={datasource}
            query={sloQuery}
            aliasBy={query.aliasBy}
            onChangeAliasBy={(aliasBy: string) => onChange({ ...query, aliasBy })}
          />
        )}
      </EditorRows>
    </span>
  );
};
