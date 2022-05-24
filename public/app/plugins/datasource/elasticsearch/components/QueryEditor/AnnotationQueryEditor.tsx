import React, { memo } from 'react';

import { AnnotationQuery } from '@grafana/data';
import { EditorRow, EditorField } from '@grafana/experimental';
import { Input } from '@grafana/ui';

import { ElasticsearchQuery } from '../../types';
import { ElasticsearchQueryEditorProps } from '../types';

import { QueryEditor } from './index';

type Props = ElasticsearchQueryEditorProps & {
  annotation?: AnnotationQuery<ElasticsearchQuery>;
  onAnnotationChange?: (annotation: AnnotationQuery<ElasticsearchQuery>) => void;
};

export const ElasticsearchAnnotationsQueryEditor = memo(function ElasticsearchAnnotationQueryEditor(props: Props) {
  const annotation = props.annotation!;
  const onAnnotationChange = props.onAnnotationChange!;

  return (
    <>
      <QueryEditor
        datasource={props.datasource}
        query={{
          refId: 'Anno',
          alias: annotation.target?.alias,
          query: annotation.target?.query,
          bucketAggs: annotation.target?.bucketAggs,
          metrics: annotation.target?.metrics,
          timeField: annotation.target?.timeField,
        }}
        onChange={(query: ElasticsearchQuery) => {
          onAnnotationChange({
            ...annotation,
            query: query.query,
          });
        }}
        onRunQuery={() => {}}
        showQueryOnly={true}
      />

      <EditorRow>
        <EditorField label="Time">
          <Input
            type="text"
            placeholder="@timestamp"
            value={annotation.timeField}
            onChange={(e) => {
              onAnnotationChange({
                ...annotation,
                timeField: e.currentTarget.value,
              });
            }}
          />
        </EditorField>
        <EditorField label="Time End">
          <Input
            type="text"
            value={annotation.timeEndField}
            onChange={(e) => {
              onAnnotationChange({
                ...annotation,
                timeEndField: e.currentTarget.value,
              });
            }}
          />
        </EditorField>
        <EditorField label="Text">
          <Input
            type="text"
            value={annotation.textField}
            onChange={(e) => {
              onAnnotationChange({
                ...annotation,
                textField: e.currentTarget.value,
              });
            }}
          />
        </EditorField>
        <EditorField label="Tags">
          <Input
            type="text"
            placeholder="tags"
            value={annotation.tagsField}
            onChange={(e) => {
              onAnnotationChange({
                ...annotation,
                tagsField: e.currentTarget.value,
              });
            }}
          />
        </EditorField>
      </EditorRow>
    </>
  );
});
