import { css } from '@emotion/css';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { Segment, SegmentInput, useStyles2 } from '@grafana/ui';

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

/**
 * Render a function parameter with a segment dropdown for multiple options or simple input.
 */
export function FunctionParamEditor({ editableParam, onChange, onExpandedChange, autofocus }: FieldEditorProps) {
  const styles = useStyles2(getStyles);

  if (editableParam.options?.length > 0) {
    return (
      <Segment
        autofocus={autofocus}
        value={editableParam.value}
        inputPlaceholder={editableParam.name}
        className={styles.segment}
        options={editableParam.options}
        placeholder={' +' + editableParam.name}
        onChange={(value) => {
          onChange(value.value || '');
        }}
        onExpandedChange={onExpandedChange}
        inputMinWidth={150}
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
        inputPlaceholder={editableParam.name}
        onChange={(value) => {
          onChange(value.toString());
        }}
        onExpandedChange={onExpandedChange}
        // input style
        style={{
          height: '25px',
          paddingTop: '2px',
          marginTop: '2px',
          paddingLeft: '4px',
          minWidth: '100px',
        }}
      ></SegmentInput>
    );
  }
}

const getStyles = (theme: GrafanaTheme2) => ({
  segment: css({
    margin: 0,
    padding: 0,
    overflowWrap: 'anywhere',
    height: '100%',
  }),
  input: css({
    margin: 0,
    padding: 0,
    input: {
      height: '25px',
    },
    overflowWrap: 'anywhere',
    height: '100%',
  }),
});
