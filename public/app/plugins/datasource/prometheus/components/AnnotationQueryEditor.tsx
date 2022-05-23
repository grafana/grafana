import React from 'react';

import { AnnotationQuery } from '@grafana/data';
import { EditorRow, EditorField, EditorSwitch, Space } from '@grafana/experimental';
import { Input } from '@grafana/ui';

import { PromQueryEditorSelector } from '../querybuilder/components/PromQueryEditorSelector';
import { QueryEditorMode } from '../querybuilder/shared/types';
import { PromQuery } from '../types';

import { PromQueryEditorProps } from './types';

type Props = PromQueryEditorProps & {
  annotation?: AnnotationQuery<PromQuery>;
  onAnnotationChange?: (annotation: AnnotationQuery<PromQuery>) => void;
};

export function AnnotationQueryEditor(props: Props) {
  // This is because of problematic typing. See AnnotationQueryEditorProps in grafana-data/annotations.ts.
  const annotation = props.annotation!;
  const onAnnotationChange = props.onAnnotationChange!;
  return (
    <>
      <PromQueryEditorSelector
        {...props}
        uiOptions={{
          modes: {
            [QueryEditorMode.Explain]: false,
            [QueryEditorMode.Code]: true,
            [QueryEditorMode.Builder]: true,
          },
          runQueryButton: false,
          options: {
            exemplars: false,
            type: false,
            format: false,
            minStep: true,
            legend: false,
            resolution: false,
          },
        }}
      />
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
          />
        </EditorField>
      </EditorRow>
    </>
  );
}
