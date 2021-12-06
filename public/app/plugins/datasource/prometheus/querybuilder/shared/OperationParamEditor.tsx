import { css } from '@emotion/css';
import { GrafanaTheme2, toOption } from '@grafana/data';
import { Button, Input, Select, useStyles2 } from '@grafana/ui';
import React, { ComponentType } from 'react';
import { QueryBuilderOperationParamDef, QueryBuilderOperationParamEditorProps } from '../shared/types';

export function OperationParamEditor(props: QueryBuilderOperationParamEditorProps) {
  const { paramDef, index, operation } = props;
  const styles = useStyles2(getStyles);
  const Editor = getInputEditor(paramDef);

  return (
    <>
      <div className={styles.param}>
        <div className={styles.name}>{paramDef.name}</div>
        <div className={styles.value}>
          <Editor {...props} />
        </div>
      </div>
      {paramDef.restParam && index === operation.params.length - 1 && (
        <div className={styles.param}>
          <div className={styles.name}></div>
          <div className={styles.value}>
            <Button size="sm" icon="plus" variant="secondary" />
          </div>
        </div>
      )}
    </>
  );
}

function getInputEditor(paramDef: QueryBuilderOperationParamDef): ComponentType<QueryBuilderOperationParamEditorProps> {
  if (paramDef.editor) {
    return paramDef.editor;
  }

  if (paramDef.options) {
    return SelectInputParamEditor;
  }

  return SimpleInputParamEditor;
}

function SimpleInputParamEditor(props: QueryBuilderOperationParamEditorProps) {
  return (
    <Input
      value={props.value ?? ''}
      onBlur={(evt) => {
        props.onChange(props.index, evt.currentTarget.value);
      }}
    />
  );
}

function SelectInputParamEditor({ paramDef, value, index, onChange }: QueryBuilderOperationParamEditorProps) {
  const selectOptions = paramDef.options!.map((option) => ({
    label: option as string,
    value: option as string,
  }));

  return (
    <Select
      menuShouldPortal
      value={toOption(value as string)}
      options={selectOptions}
      onChange={(value) => onChange(index, value.value!)}
    />
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    param: css({
      display: 'table-row',
    }),
    name: css({
      display: 'table-cell',
      padding: theme.spacing(0, 1, 0, 0),
      fontSize: theme.typography.bodySmall.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
    }),
    value: css({
      display: 'table-cell',
      paddingBottom: theme.spacing(0.5),
    }),
  };
};
