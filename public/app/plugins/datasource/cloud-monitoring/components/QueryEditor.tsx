import React, { useEffect, useMemo, useState } from 'react';

import { QueryEditorProps, toOption } from '@grafana/data';
import { EditorRows } from '@grafana/experimental';
import { ConfirmModal } from '@grafana/ui';

import CloudMonitoringDatasource from '../datasource';
import { CloudMonitoringQuery, PromQLQuery, QueryType, SLOQuery } from '../types/query';
import { CloudMonitoringOptions } from '../types/types';

import { PromQLQueryEditor } from './PromQLEditor';
import { QueryHeader } from './QueryHeader';
import { defaultQuery as defaultSLOQuery } from './SLOQueryEditor';

import { MetricQueryEditor, SLOQueryEditor } from './';

export type Props = QueryEditorProps<CloudMonitoringDatasource, CloudMonitoringQuery, CloudMonitoringOptions>;

export const QueryEditor = (props: Props) => {
  const { datasource, query: oldQ, onRunQuery, onChange } = props;
  const [modalIsOpen, setModalIsOpen] = useState<boolean>(false);
  // Migrate query if needed
  const [migrated, setMigrated] = useState(false);
  const query = useMemo(() => {
    if (!migrated) {
      setMigrated(true);
      const migratedQuery = datasource.migrateQuery(oldQ);
      // Update the query once the migrations have been completed.
      onChange({ ...migratedQuery });
      return migratedQuery;
    }
    return oldQ;
  }, [oldQ, datasource, onChange, migrated]);
  const [selectedQuery, setSelectedQuery] = useState<CloudMonitoringQuery>(query);

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
      selectedQuery.queryType === QueryType.TIME_SERIES_LIST ||
      selectedQuery.queryType === QueryType.TIME_SERIES_QUERY
    ) {
      if (selectedQuery.queryType !== q.queryType) {
        setSelectedQuery(q);
        setModalIsOpen(true);
      }
    } else {
      setSelectedQuery(q);
      onChange(q);
    }
  };

  return (
    <EditorRows>
      <ConfirmModal
        data-testid="switch-query-type-modal"
        title="Warning"
        body="By switching your query type, your current query will be lost."
        isOpen={modalIsOpen}
        onConfirm={() => {
          setModalIsOpen(false);
          onChange(selectedQuery);
        }}
        confirmText="Confirm"
        onDismiss={() => {
          setModalIsOpen(false);
          setSelectedQuery(query);
        }}
      ></ConfirmModal>
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
          onChange={onChange}
          onRunQuery={onRunQuery}
          datasource={datasource}
          query={query}
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
  );
};
