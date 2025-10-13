// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/querybuilder/shared/OperationParamEditor.tsx
import { css } from '@emotion/css';
import { ComponentType } from 'react';

import { GrafanaTheme2, SelectableValue, toOption } from '@grafana/data';
import { AutoSizeInput, Button, Checkbox, Select, useStyles2, Stack } from '@grafana/ui';

import { getOperationParamId } from '../operationUtils';

import { QueryBuilderOperationParamDef, QueryBuilderOperationParamEditorProps } from './types';

export function getOperationParamEditor(
  paramDef: QueryBuilderOperationParamDef
): ComponentType<QueryBuilderOperationParamEditorProps> {
  if (paramDef.editor) {
    return paramDef.editor;
  }

  if (paramDef.options) {
    return SelectInputParamEditor;
  }

  switch (paramDef.type) {
    case 'boolean':
      return BoolInputParamEditor;
    case 'number':
    case 'string':
    default:
      return SimpleInputParamEditor;
  }
}

function SimpleInputParamEditor(props: QueryBuilderOperationParamEditorProps) {
  return (
    <AutoSizeInput
      id={getOperationParamId(props.operationId, props.index)}
      defaultValue={props.value?.toString()}
      minWidth={props.paramDef.minWidth}
      placeholder={props.paramDef.placeholder}
      title={props.paramDef.description}
      maxWidth={(props.paramDef.minWidth || 20) * 3}
      onCommitChange={(evt) => {
        props.onChange(props.index, evt.currentTarget.value);
        if (props.paramDef.runQueryOnEnter && evt.type === 'keydown') {
          props.onRunQuery();
        }
      }}
    />
  );
}

function BoolInputParamEditor(props: QueryBuilderOperationParamEditorProps) {
  return (
    <Checkbox
      id={getOperationParamId(props.operationId, props.index)}
      value={Boolean(props.value)}
      onChange={(evt) => props.onChange(props.index, evt.currentTarget.checked)}
    />
  );
}

function SelectInputParamEditor({
  paramDef,
  value,
  index,
  operationId,
  onChange,
}: QueryBuilderOperationParamEditorProps) {
  const styles = useStyles2(getStyles);
  let selectOptions = paramDef.options as SelectableValue[];

  if (!selectOptions[0]?.label) {
    selectOptions = paramDef.options!.map((option) => ({
      label: option.toString(),
      value: option,
    }));
  }

  let valueOption = selectOptions.find((x) => x.value === value) ?? toOption(value as string);

  // If we have optional options param and don't have value, we want to render button with which we add optional options.
  // This makes it easier to understand what needs to be selected and what is optional.
  if (!value && paramDef.optional) {
    return (
      <div className={styles.optionalParam}>
        <Button
          size="sm"
          variant="secondary"
          title={`Add ${paramDef.name}`}
          icon="plus"
          onClick={() => onChange(index, selectOptions[0].value)}
        >
          {paramDef.name}
        </Button>
      </div>
    );
  }

  return (
    <Stack gap={0.5} direction="row" alignItems="center">
      <Select
        id={getOperationParamId(operationId, index)}
        value={valueOption}
        options={selectOptions}
        placeholder={paramDef.placeholder}
        allowCustomValue={true}
        onChange={(value) => onChange(index, value.value!)}
        width={paramDef.minWidth || 'auto'}
      />
      {paramDef.optional && (
        <Button
          data-testid={`operations.${index}.remove-param`}
          size="sm"
          fill="text"
          icon="times"
          variant="secondary"
          title={`Remove ${paramDef.name}`}
          onClick={() => onChange(index, '')}
        />
      )}
    </Stack>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    optionalParam: css({
      marginTop: theme.spacing(1),
    }),
  };
};
