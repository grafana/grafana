import React from 'react';

import { QueryEditorProps, toOption } from '@grafana/data';
import { LegacyForms } from '@grafana/ui';

import CloudMonitoringDatasource from '../datasource';
import {
  EditorMode,
  MetricKind,
  MetricQuery,
  CloudMonitoringOptions,
  CloudMonitoringQuery,
  AlignmentTypes,
} from '../types';

import { MetricQueryEditor } from './MetricQueryEditor';

import { AnnotationsHelp, QueryEditorRow } from './';

const { Input } = LegacyForms;

export type Props = QueryEditorProps<CloudMonitoringDatasource, CloudMonitoringQuery, CloudMonitoringOptions>;

export const defaultQuery: (datasource: CloudMonitoringDatasource) => MetricQuery = (datasource) => ({
  editorMode: EditorMode.Visual,
  projectName: datasource.getDefaultProject(),
  projects: [],
  metricType: '',
  filters: [],
  metricKind: MetricKind.GAUGE,
  valueType: '',
  refId: 'annotationQuery',
  title: '',
  text: '',
  labels: {},
  variableOptionGroup: {},
  variableOptions: [],
  query: '',
  crossSeriesReducer: 'REDUCE_NONE',
  perSeriesAligner: AlignmentTypes.ALIGN_NONE,
});

export const AnnotationQueryEditor = (props: Props) => {
  const { datasource, query, onRunQuery, data } = props;
  const meta = data?.series.length ? data?.series[0].meta : {};
  const customMetaData = meta?.custom ?? {};
  const metricQuery = { ...defaultQuery(datasource), ...query.metricQuery };
  const { title = '', text = '' } = metricQuery || {};
  const variableOptionGroup = {
    label: 'Template Variables',
    options: datasource.getVariables().map(toOption),
  };

  return (
    <>
      <MetricQueryEditor
        refId={query.refId}
        variableOptionGroup={variableOptionGroup}
        customMetaData={customMetaData}
        onChange={(metricQuery) => {
          props.onChange({ ...props.query, metricQuery });
        }}
        onRunQuery={onRunQuery}
        datasource={datasource}
        query={metricQuery}
      />

      <QueryEditorRow label="Title" htmlFor="annotation-query-title">
        <Input
          id="annotation-query-title"
          type="text"
          className="gf-form-input width-20"
          value={title}
          onChange={(e) => props.onChange({ ...props.query, metricQuery: { ...metricQuery, title: e.target.value } })}
        />
      </QueryEditorRow>

      <QueryEditorRow label="Text" htmlFor="annotation-query-text">
        <Input
          id="annotation-query-text"
          type="text"
          className="gf-form-input width-20"
          value={text}
          onChange={(e) => props.onChange({ ...props.query, metricQuery: { ...metricQuery, text: e.target.value } })}
        />
      </QueryEditorRow>

      <AnnotationsHelp />
    </>
  );
};
