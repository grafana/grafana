import React, { useEffect, useMemo, useState } from 'react';

import { QueryEditorProps, toOption } from '@grafana/data';
import { EditorRows } from '@grafana/experimental';

import CloudMonitoringDatasource from '../datasource';
import { CloudMonitoringQuery, QueryType, SLOQuery, CloudMonitoringOptions, EditorMode } from '../types';

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
  const [editorMode, setEditorMode] = useState<EditorMode>(
    query.timeSeriesQuery?.query ? EditorMode.MQL : EditorMode.Visual
  );

  // Use a known query type
  useEffect(() => {
    if (!Object.values(QueryType).includes(query.queryType)) {
      onChange({ ...query, queryType: QueryType.METRICS });
    }
  });
  const queryType = query.queryType;

  return (
    <EditorRows>
      <QueryHeader
        query={query}
        onChange={onChange}
        onRunQuery={onRunQuery}
        editorMode={editorMode}
        setEditorMode={setEditorMode}
      />
      {queryType === QueryType.METRICS && (
        <MetricQueryEditor
          refId={query.refId}
          variableOptionGroup={variableOptionGroup}
          customMetaData={customMetaData}
          onChange={onChange}
          onRunQuery={onRunQuery}
          datasource={datasource}
          query={query}
          editorMode={editorMode}
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
        />
      )}
    </EditorRows>
  );
};
