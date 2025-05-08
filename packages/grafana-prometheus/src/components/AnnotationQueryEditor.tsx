// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/components/AnnotationQueryEditor.tsx

import { memo } from 'react';

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

const PLACEHOLDER_TITLE = '{{alertname}}';
const PLACEHOLDER_TEXT = '{{instance}}';
const PLACEHOLDER_TAGS = 'label1,label2';

/**
 * AnnotationQueryEditor component for Prometheus datasource.
 * Allows users to configure annotation queries with options for title, tags, text format,
 * and timestamp settings.
 */
export const AnnotationQueryEditor = memo(function AnnotationQueryEditor(props: Props) {
  const { annotation, onAnnotationChange, onChange, onRunQuery, query } = props;

  if (!annotation || !onAnnotationChange) {
    return <h3>annotation data load error!</h3>;
  }

  const handleMinStepChange = (value: string) => {
    onChange({ ...query, interval: value });
  };

  const handleTitleChange = (value: string) => {
    onAnnotationChange({
      ...annotation,
      titleFormat: value,
    });
  };

  const handleTagsChange = (value: string) => {
    onAnnotationChange({
      ...annotation,
      tagKeys: value,
    });
  };

  const handleTextChange = (value: string) => {
    onAnnotationChange({
      ...annotation,
      textFormat: value,
    });
  };

  const handleUseValueForTimeChange = (checked: boolean) => {
    onAnnotationChange({
      ...annotation,
      useValueForTime: checked,
    });
  };

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
              onChange={(e) => handleMinStepChange(e.currentTarget.value)}
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
            placeholder={PLACEHOLDER_TITLE}
            value={annotation.titleFormat ?? ''}
            onChange={(event) => handleTitleChange(event.currentTarget.value)}
            data-testid={selectors.components.DataSource.Prometheus.annotations.title}
          />
        </EditorField>
        <EditorField label="Tags">
          <Input
            type="text"
            placeholder={PLACEHOLDER_TAGS}
            value={annotation.tagKeys ?? ''}
            onChange={(event) => handleTagsChange(event.currentTarget.value)}
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
            placeholder={PLACEHOLDER_TEXT}
            value={annotation.textFormat ?? ''}
            onChange={(event) => handleTextChange(event.currentTarget.value)}
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
            value={annotation.useValueForTime ?? false}
            onChange={(event) => handleUseValueForTimeChange(event.currentTarget.checked)}
            data-testid={selectors.components.DataSource.Prometheus.annotations.seriesValueAsTimestamp}
          />
        </EditorField>
      </EditorRow>
    </>
  );
});
