import React, { useEffect, useState } from 'react';
import { useDebounce } from 'react-use';

import { QueryEditorProps, toOption } from '@grafana/data';
import { EditorField, EditorRows } from '@grafana/experimental';
import { Input } from '@grafana/ui';

import CloudMonitoringDatasource from '../datasource';
import { AnnotationQuery, CloudMonitoringOptions, CloudMonitoringQuery, QueryType } from '../types';

import { MetricQueryEditor, defaultTimeSeriesList } from './MetricQueryEditor';

import { AnnotationsHelp } from './';

export type Props = QueryEditorProps<CloudMonitoringDatasource, CloudMonitoringQuery, CloudMonitoringOptions>;

export const defaultQuery: (datasource: CloudMonitoringDatasource) => AnnotationQuery = (datasource) => ({
  ...defaultTimeSeriesList(datasource),
  title: '',
  text: '',
});

export const AnnotationQueryEditor = (props: Props) => {
  const { datasource, query, onRunQuery, data, onChange } = props;
  const meta = data?.series.length ? data?.series[0].meta : {};
  const customMetaData = meta?.custom ?? {};
  const timeSeriesList = { ...defaultQuery(datasource), ...query.timeSeriesList };
  const [title, setTitle] = useState(timeSeriesList.title || '');
  const [text, setText] = useState(timeSeriesList.text || '');
  const variableOptionGroup = {
    label: 'Template Variables',
    options: datasource.getVariables().map(toOption),
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
  };
  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setText(e.target.value);
  };

  useDebounce(
    () => {
      onChange({ ...query, timeSeriesList: { ...timeSeriesList, title } });
    },
    1000,
    [title, onChange]
  );
  useDebounce(
    () => {
      onChange({ ...query, timeSeriesList: { ...timeSeriesList, text } });
    },
    1000,
    [text, onChange]
  );

  // Use a known query type
  useEffect(() => {
    if (!Object.values(QueryType).includes(query.queryType)) {
      onChange({ ...query, queryType: QueryType.TIME_SERIES_LIST });
    }
  });

  return (
    <EditorRows>
      <>
        <MetricQueryEditor
          refId={query.refId}
          variableOptionGroup={variableOptionGroup}
          customMetaData={customMetaData}
          onChange={onChange}
          onRunQuery={onRunQuery}
          datasource={datasource}
          query={query}
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
