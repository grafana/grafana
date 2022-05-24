// Libraries
import React, { memo } from 'react';

import { AnnotationQuery } from '@grafana/data';
import { EditorRow, EditorField } from '@grafana/experimental';
import { Input } from '@grafana/ui';

// Types
import { LokiQuery } from '../types';

import { LokiOptionFields } from './LokiOptionFields';
import { LokiQueryField } from './LokiQueryField';
import { LokiQueryEditorProps } from './types';

type Props = LokiQueryEditorProps & {
  annotation?: AnnotationQuery<LokiQuery>;
  onAnnotationChange?: (annotation: AnnotationQuery<LokiQuery>) => void;
};

export const LokiAnnotationsQueryEditor = memo(function LokiAnnotationQueryEditor(props: Props) {
  const annotation = props.annotation!;
  const onAnnotationChange = props.onAnnotationChange!;

  const onChangeQuery = (query: LokiQuery) => {
    onAnnotationChange({
      ...annotation,
      expr: query.expr,
      maxLines: query.maxLines,
      instant: query.instant,
      queryType: query.queryType,
    });
  };

  const queryWithRefId: LokiQuery = {
    refId: '',
    expr: annotation.expr,
    maxLines: annotation.maxLines,
    instant: annotation.instant,
    queryType: annotation.queryType,
  };
  return (
    <>
      <div className="gf-form-group">
        <LokiQueryField
          datasource={props.datasource}
          query={queryWithRefId}
          onChange={onChangeQuery}
          onRunQuery={() => {}}
          onBlur={() => {}}
          history={[]}
          ExtraFieldElement={
            <LokiOptionFields
              lineLimitValue={queryWithRefId?.maxLines?.toString() || ''}
              resolution={queryWithRefId.resolution || 1}
              query={queryWithRefId}
              onRunQuery={() => {}}
              onChange={onChangeQuery}
            />
          }
        />
      </div>

      <EditorRow>
        <EditorField
          label="Title"
          tooltip={
            'Use either the name or a pattern. For example, {{instance}} is replaced with label value for the label instance.'
          }
        >
          <Input
            type="text"
            placeholder="alertname"
            value={annotation.titleFormat}
            onChange={(event) => {
              onAnnotationChange({
                ...annotation,
                titleFormat: event.currentTarget.value,
              });
            }}
          />
        </EditorField>
        <EditorField label="Tags">
          <Input
            type="text"
            placeholder="label1,label2"
            value={annotation.tagKeys}
            onChange={(event) => {
              onAnnotationChange({
                ...annotation,
                tagKeys: event.currentTarget.value,
              });
            }}
          />
        </EditorField>
        <EditorField
          label="Text"
          tooltip={
            'Use either the name or a pattern. For example, {{instance}} is replaced with label value for the label instance.'
          }
        >
          <Input
            type="text"
            placeholder="instance"
            value={annotation.textFormat}
            onChange={(event) => {
              onAnnotationChange({
                ...annotation,
                textFormat: event.currentTarget.value,
              });
            }}
          />
        </EditorField>
      </EditorRow>
    </>
  );
});
