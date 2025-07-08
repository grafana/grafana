import { AnnotationQuery } from '@grafana/data';
import { EditorField, EditorRow } from '@grafana/plugin-ui';
import { Input, Stack } from '@grafana/ui';

import { ElasticsearchDataQuery } from '../../dataquery.gen';

import { ElasticQueryEditorProps, ElasticSearchQueryField } from './index';

type Props = ElasticQueryEditorProps & {
  annotation?: AnnotationQuery<ElasticsearchDataQuery>;
  onAnnotationChange?: (annotation: AnnotationQuery<ElasticsearchDataQuery>) => void;
};

export function ElasticsearchAnnotationsQueryEditor(props: Props) {
  const annotation = props.annotation!;
  const onAnnotationChange = props.onAnnotationChange!;

  return (
    <Stack direction="column" gap={5}>
      <div>
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

      <div>
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

      {/*Empty div to preserve the bottom margin */}
      <div />
    </Stack>
  );
}
