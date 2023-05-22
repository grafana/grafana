import React, { useEffect, useMemo, useState } from 'react';

import { QueryEditorProps, toOption } from '@grafana/data';
import { EditorRows } from '@grafana/experimental';

import CloudMonitoringDatasource from '../datasource';
import { CloudMonitoringQuery, QueryType, SLOQuery, CloudMonitoringOptions } from '../types';

import { QueryHeader } from './QueryHeader';
import { defaultQuery as defaultSLOQuery } from './SLOQueryEditor';

import { MetricQueryEditor, SLOQueryEditor } from './';

export type Props = QueryEditorProps<CloudMonitoringDatasource, CloudMonitoringQuery, CloudMonitoringOptions>;

export const QueryEditor = (props: Props) => {
  const { datasource, query: oldQ, onRunQuery, onChange } = props;
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

  const sloQuery = { ...defaultSLOQuery(datasource), ...query.sloQuery };
  const onSLOQueryChange = (q: SLOQuery) => {
    onChange({ ...query, sloQuery: q });
    onRunQuery();
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
    if (!Object.values(QueryType).includes(query.queryType)) {
      onChange({ ...query, queryType: QueryType.TIME_SERIES_LIST });
    }
  });
  const queryType = query.queryType;

  return (
    <EditorRows>
      <QueryHeader query={query} onChange={onChange} onRunQuery={onRunQuery} />
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
