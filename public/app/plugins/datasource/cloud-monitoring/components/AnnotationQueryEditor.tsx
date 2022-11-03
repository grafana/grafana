import React, { useState } from 'react';
import { useDebounce } from 'react-use';

import { QueryEditorProps, toOption } from '@grafana/data';
import { EditorField, EditorRows } from '@grafana/experimental';
import { Input } from '@grafana/ui';

import CloudMonitoringDatasource from '../datasource';
import {
  EditorMode,
  MetricKind,
  AnnotationMetricQuery,
  CloudMonitoringOptions,
  CloudMonitoringQuery,
  AlignmentTypes,
} from '../types';

import { MetricQueryEditor } from './MetricQueryEditor';

import { AnnotationsHelp } from './';

export type Props = QueryEditorProps<CloudMonitoringDatasource, CloudMonitoringQuery, CloudMonitoringOptions>;

export const defaultQuery: (datasource: CloudMonitoringDatasource) => AnnotationMetricQuery = (datasource) => ({
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
  alignmentPeriod: 'grafana-auto',
});

export const AnnotationQueryEditor = (props: Props) => {
  const { datasource, query, onRunQuery, data, onChange } = props;
  const meta = data?.series.length ? data?.series[0].meta : {};
  const customMetaData = meta?.custom ?? {};
  const metricQuery = { ...defaultQuery(datasource), ...query.metricQuery };
  const [title, setTitle] = useState(metricQuery.title || '');
  const [text, setText] = useState(metricQuery.text || '');
  const variableOptionGroup = {
    label: 'Template Variables',
    options: datasource.getVariables().map(toOption),
  };

  const handleQueryChange = (metricQuery: AnnotationMetricQuery) => onChange({ ...query, metricQuery });
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
  };
  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setText(e.target.value);
  };

  useDebounce(
    () => {
      onChange({ ...query, metricQuery: { ...metricQuery, title } });
    },
    1000,
    [title, onChange]
  );
  useDebounce(
    () => {
      onChange({ ...query, metricQuery: { ...metricQuery, text } });
    },
    1000,
    [text, onChange]
  );

  return (
    <EditorRows>
      <>
        <MetricQueryEditor
          refId={query.refId}
          variableOptionGroup={variableOptionGroup}
          customMetaData={customMetaData}
          onChange={handleQueryChange}
          onRunQuery={onRunQuery}
          datasource={datasource}
          query={metricQuery}
        />
        <EditorField label="Title" htmlFor="annotation-query-title">
          <Input id="annotation-query-title" value={title} onChange={handleTitleChange} />
        </EditorField>
        <EditorField label="Text" htmlFor="annotation-query-text">
          <Input id="annotation-query-text" value={text} onChange={handleTextChange} />
        </EditorField>
      </>
      <AnnotationsHelp />
    </EditorRows>
  );
};
