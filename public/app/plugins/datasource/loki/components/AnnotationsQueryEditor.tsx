import { memo } from 'react';

import { AnnotationQuery } from '@grafana/data';
import { EditorField, EditorRow } from '@grafana/plugin-ui';
import { Input, Stack } from '@grafana/ui';

import { LokiQuery } from '../types';

import { LokiOptionFields } from './LokiOptionFields';
import { LokiQueryField } from './LokiQueryField';
import { LokiQueryEditorProps } from './types';

type Props = LokiQueryEditorProps & {
  annotation?: AnnotationQuery<LokiQuery>;
  onAnnotationChange?: (annotation: AnnotationQuery<LokiQuery>) => void;
};

export const LokiAnnotationsQueryEditor = memo(function LokiAnnotationQueryEditor(props: Props) {
  const { annotation, onAnnotationChange, history } = props;

  // this should never happen, but we want to keep typescript happy
  if (annotation === undefined || onAnnotationChange === undefined) {
    return null;
  }

  const onChangeQuery = (query: LokiQuery) => {
    onAnnotationChange({
      ...annotation,
      expr: query.expr,
      maxLines: query.maxLines,
      queryType: 'range',
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
    <Stack gap={5} direction="column">
      <Stack gap={0} direction="column">
        <LokiQueryField
          datasource={props.datasource}
          query={queryWithRefId}
          onChange={onChangeQuery}
          onRunQuery={() => {}}
          history={history}
          ExtraFieldElement={
            <LokiOptionFields
              lineLimitValue={queryWithRefId?.maxLines?.toString() || ''}
              query={queryWithRefId}
              onRunQuery={() => {}}
              onChange={onChangeQuery}
            />
          }
        />
      </Stack>
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
    </Stack>
  );
});
