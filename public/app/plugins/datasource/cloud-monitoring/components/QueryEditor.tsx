import React, { useEffect, useMemo, useState } from 'react';

import { QueryEditorProps, toOption } from '@grafana/data';
import { EditorRows } from '@grafana/experimental';

import { QueryType, SLOQuery } from '../dataquery.gen';
import CloudMonitoringDatasource from '../datasource';
import { CloudMonitoringQuery, CloudMonitoringOptions } from '../types';

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
      return datasource.migrateQuery(oldQ);
    }
    return oldQ;
  }, [oldQ, datasource, migrated]);

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
      onChange({ ...query, queryType: QueryType.TimeSeriesList });
    }
  });
  const queryType = query.queryType;

  return (
    <EditorRows>
      <QueryHeader query={query} onChange={onChange} onRunQuery={onRunQuery} />
      {queryType !== QueryType.Slo && (
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

      {queryType === QueryType.Slo && (
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
