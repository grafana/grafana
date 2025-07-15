// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/querybuilder/shared/OperationParamEditor.tsx
import { css } from '@emotion/css';
import { ComponentType } from 'react';

import { GrafanaTheme2, SelectableValue, toOption } from '@grafana/data';
import { t } from '@grafana/i18n';
import { AutoSizeInput, Button, Checkbox, Select, useStyles2, Stack } from '@grafana/ui';

import { LabelParamEditor } from '../components/LabelParamEditor';

import { getOperationParamId } from './param_utils';
import { QueryBuilderOperationParamDef, QueryBuilderOperationParamEditorProps } from './types';

/**
 * Registry of operation parameter editors that can be referenced by key.
 *
 * This approach solves a circular dependency problem in the codebase:
 * - Operation definitions need to reference editors (e.g., LabelParamEditor)
 * - Editors need to reference the modeller instance
 * - The modeller instance needs to reference operation definitions
 *
 * By using string keys instead of direct imports, we break this cycle:
 * 1. Operation definitions reference editors by key (no component import needed)
 * 2. The registry maps these keys to actual editor components
 * 3. The wrapper component (OperationParamEditorWrapper) injects the modeller instance
 *
 * This creates a clear dependency flow:
 * Operation Definitions -> Registry -> Editor Components <- Wrapper <- Modeller Instance
 *
 * @example
 * ```ts
 * {
 *   id: 'someOperation',
 *   params: [{
 *     name: 'Label',
 *     type: 'string',
 *     editor: 'LabelParamEditor' // Reference by key instead of supplying the component directly
 *   }]
 * }
 * ```
 */
const editorMap: Record<string, ComponentType<QueryBuilderOperationParamEditorProps>> = {
  // The wrapper component will ensure the modeller is provided
  LabelParamEditor: LabelParamEditor as ComponentType<QueryBuilderOperationParamEditorProps>,
};

/**
 * Resolves an operation parameter editor based on the parameter definition.
 *
 * The editor can be specified in three ways:
 * 1. As a string key referencing a registered editor in editorMap
 * 2. As a direct component reference
 * 3. Based on the parameter type (string, number, boolean) or options
 *
 * This flexibility allows operation definitions to be decoupled from editor implementations
 * while maintaining type safety and clear dependencies.
 */
export function getOperationParamEditor(
  paramDef: QueryBuilderOperationParamDef
): ComponentType<QueryBuilderOperationParamEditorProps> {
  if (paramDef.editor) {
    if (typeof paramDef.editor === 'string') {
      return editorMap[paramDef.editor] || SimpleInputParamEditor;
    }
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
          title={t('grafana-prometheus.querybuilder.operation-param-editor.title-add', 'Add {{name}}', {
            name: paramDef.name,
          })}
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
          title={t('grafana-prometheus.querybuilder.operation-param-editor.title-remove', 'Remove {{name}}', {
            name: paramDef.name,
          })}
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
