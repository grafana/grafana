import { css } from '@emotion/css';
import React from 'react';

import { AnnotationQuery, GrafanaTheme2 } from '@grafana/data';
import { EditorField, EditorRow } from '@grafana/experimental';
import { Input, useStyles2 } from '@grafana/ui';

import { ElasticsearchQuery } from '../../types';

import { ElasticQueryEditorProps, ElasticSearchQueryField } from './index';

type Props = ElasticQueryEditorProps & {
  annotation?: AnnotationQuery<ElasticsearchQuery>;
  onAnnotationChange?: (annotation: AnnotationQuery<ElasticsearchQuery>) => void;
};

export function ElasticsearchAnnotationsQueryEditor(props: Props) {
  const annotation = props.annotation!;
  const onAnnotationChange = props.onAnnotationChange!;

  const styles = useStyles2(getStyles);
  return (
    <>
      <div className={styles.container}>
        <ElasticSearchQueryField
          value={annotation.target?.query}
          onChange={(query) => {
            const currentTarget = annotation.target ?? { refId: 'annotation_query' };
            const newTarget = {
              ...currentTarget,
              query,
            };

            onAnnotationChange({
              ...annotation,
              target: newTarget,
            });
          }}
        />
      </div>

      <div className={styles.container}>
        <h6>Field mappings</h6>
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
      </div>
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    marginBottom: theme.spacing(5),
  }),
});
