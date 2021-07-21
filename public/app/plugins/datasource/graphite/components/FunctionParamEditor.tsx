import React from 'react';
import { Segment, SegmentInput, useStyles2 } from '@grafana/ui';
import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { css } from '@emotion/css';

export type EditableParam = {
  name: string;
  value: string;
  optional: boolean;
  multiple: boolean;
  options: Array<SelectableValue<string>>;
};

type FieldEditorProps = {
  editableParam: EditableParam;
  onChange: (value: string) => void;
  onExpandedChange: (expanded: boolean) => void;
  autofocus: boolean;
};

export function FunctionParamEditor({ editableParam, onChange, onExpandedChange, autofocus }: FieldEditorProps) {
  const styles = useStyles2(getStyles);

  if (editableParam.options?.length > 0) {
    return (
      <Segment
        autofocus={autofocus}
        value={editableParam.value}
        className={styles.segment}
        options={editableParam.options}
        placeholder={' +' + editableParam.name}
        onChange={(value) => {
          onChange(value.value || '');
        }}
        onExpandedChange={onExpandedChange}
        inputMinWidth={100}
        allowCustomValue={true}
        allowEmptyValue={true}
      ></Segment>
    );
  } else {
    return (
      <SegmentInput
        autofocus={autofocus}
        className={styles.input}
        value={editableParam.value || ''}
        placeholder={' +' + editableParam.name}
        onChange={(value) => {
          onChange(value.toString());
        }}
        onExpandedChange={onExpandedChange}
        style={{ height: '28px', paddingTop: '2px', paddingLeft: '4px', fontSize: '12px' }}
      ></SegmentInput>
    );
  }
}

const getStyles = (theme: GrafanaTheme2) => ({
  segment: css({
    margin: 0,
    padding: 0,
  }),
  input: css({
    margin: 0,
    padding: 0,
    height: theme.components.height.sm,
  }),
});
