// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/components/AnnotationQueryEditor.tsx

import { memo } from 'react';

import { AnnotationQuery } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
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
    return (
      <h3>
        <Trans i18nKey="grafana-prometheus.components.annotation-query-editor.annotation-data-load-error">
          Annotation data load error!
        </Trans>
      </h3>
    );
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
            label={t('grafana-prometheus.components.annotation-query-editor.label-min-step', 'Min step')}
            tooltip={
              <Trans
                i18nKey="grafana-prometheus.components.annotation-query-editor.tooltip-min-step"
                values={{ intervalVar: '$__interval', rateIntervalVar: '$__rate_interval' }}
              >
                An additional lower limit for the step parameter of the Prometheus query and for the{' '}
                <code>{'{{intervalVar}}'}</code> and <code>{'{{rateIntervalVar}}'}</code> variables.
              </Trans>
            }
          >
            <AutoSizeInput
              type="text"
              aria-label={t(
                'grafana-prometheus.components.annotation-query-editor.aria-label-lower-limit-parameter',
                'Set lower limit for the step parameter'
              )}
              placeholder={t('grafana-prometheus.components.annotation-query-editor.placeholder-auto', 'auto')}
              minWidth={10}
              value={query.interval ?? ''}
              onChange={(e) => handleMinStepChange(e.currentTarget.value)}
              id={selectors.components.DataSource.Prometheus.annotations.minStep}
              data-testid={selectors.components.DataSource.Prometheus.annotations.minStep}
            />
          </EditorField>
        </EditorRow>
      </EditorRows>
      <Space v={0.5} />
      <EditorRow>
        <EditorField
          label={t('grafana-prometheus.components.annotation-query-editor.label-title', 'Title')}
          tooltip={t(
            'grafana-prometheus.components.annotation-query-editor.tooltip-either-pattern-example-instance-replaced-label',
            'Use either the name or a pattern. For example, {{labelTemplate}} is replaced with label value for the label {{labelName}}.',
            { labelName: 'instance', labelTemplate: '{{instance}}' }
          )}
        >
          <Input
            type="text"
            placeholder={PLACEHOLDER_TITLE}
            value={annotation.titleFormat ?? ''}
            onChange={(event) => handleTitleChange(event.currentTarget.value)}
            data-testid={selectors.components.DataSource.Prometheus.annotations.title}
          />
        </EditorField>
        <EditorField label={t('grafana-prometheus.components.annotation-query-editor.label-tags', 'Tags')}>
          <Input
            type="text"
            placeholder={PLACEHOLDER_TAGS}
            value={annotation.tagKeys ?? ''}
            onChange={(event) => handleTagsChange(event.currentTarget.value)}
            data-testid={selectors.components.DataSource.Prometheus.annotations.tags}
          />
        </EditorField>
        <EditorField
          label={t('grafana-prometheus.components.annotation-query-editor.label-text', 'Text')}
          tooltip={t(
            'grafana-prometheus.components.annotation-query-editor.tooltip-either-pattern-example-instance-replaced-label',
            'Use either the name or a pattern. For example, {{labelTemplate}} is replaced with label value for the label {{labelName}}.',
            { labelName: 'instance', labelTemplate: '{{instance}}' }
          )}
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
          label={t(
            'grafana-prometheus.components.annotation-query-editor.label-series-value-as-timestamp',
            'Series value as timestamp'
          )}
          tooltip={t(
            'grafana-prometheus.components.annotation-query-editor.tooltip-timestamp-milliseconds-series-value-seconds-multiply',
            'The unit of timestamp is milliseconds. If the unit of the series value is seconds, multiply its range vector by 1000.'
          )}
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
