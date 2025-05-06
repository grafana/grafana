// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/components/AnnotationQueryEditor.tsx

import { AnnotationQuery } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { EditorField, EditorRow, EditorRows, EditorSwitch } from '@grafana/plugin-ui';
import { AutoSizeInput, Input, Space } from '@grafana/ui';

import { PromQueryCodeEditor } from '../querybuilder/components/PromQueryCodeEditor';
import { PromQuery } from '../types';

import { PromQueryEditorProps } from './types';

type Props = PromQueryEditorProps & {
  annotation?: AnnotationQuery<PromQuery>;
  onAnnotationChange?: (annotation: AnnotationQuery<PromQuery>) => void;
};

export function AnnotationQueryEditor(props: Props) {
  const { annotation, onAnnotationChange, onChange, onRunQuery, query } = props;

  if (!annotation || !onAnnotationChange) {
    return <h3>annotation data load error!</h3>;
  }

  return (
    <>
      <EditorRows>
        <PromQueryCodeEditor {...props} query={query} showExplain={false} onRunQuery={onRunQuery} onChange={onChange} />
        <EditorRow>
          <EditorField
            label="Min step"
            tooltip={
              <>
                An additional lower limit for the step parameter of the Prometheus query and for the{' '}
                <code>$__interval</code> and <code>$__rate_interval</code> variables.
              </>
            }
          >
            <AutoSizeInput
              type="text"
              aria-label="Set lower limit for the step parameter"
              placeholder={'auto'}
              minWidth={10}
              value={query.interval ?? ''}
              onChange={(e) => onChange({ ...query, interval: e.currentTarget.value })}
              id={selectors.components.DataSource.Prometheus.annotations.minStep}
            />
          </EditorField>
        </EditorRow>
      </EditorRows>
      <Space v={0.5} />
      <EditorRow>
        <EditorField
          label="Title"
          tooltip={
            'Use either the name or a pattern. For example, {{instance}} is replaced with label value for the label instance.'
          }
        >
          <Input
            type="text"
            placeholder="{{alertname}}"
            value={annotation.titleFormat}
            onChange={(event) => {
              onAnnotationChange({
                ...annotation,
                titleFormat: event.currentTarget.value,
              });
            }}
            data-testid={selectors.components.DataSource.Prometheus.annotations.title}
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
            data-testid={selectors.components.DataSource.Prometheus.annotations.tags}
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
            placeholder="{{instance}}"
            value={annotation.textFormat}
            onChange={(event) => {
              onAnnotationChange({
                ...annotation,
                textFormat: event.currentTarget.value,
              });
            }}
            data-testid={selectors.components.DataSource.Prometheus.annotations.text}
          />
        </EditorField>
        <EditorField
          label="Series value as timestamp"
          tooltip={
            'The unit of timestamp is milliseconds. If the unit of the series value is seconds, multiply its range vector by 1000.'
          }
        >
          <EditorSwitch
            value={annotation.useValueForTime}
            onChange={(event) => {
              onAnnotationChange({
                ...annotation,
                useValueForTime: event.currentTarget.value,
              });
            }}
            data-testid={selectors.components.DataSource.Prometheus.annotations.seriesValueAsTimestamp}
          />
        </EditorField>
      </EditorRow>
    </>
  );
}
