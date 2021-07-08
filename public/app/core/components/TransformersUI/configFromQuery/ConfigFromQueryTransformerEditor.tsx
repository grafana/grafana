import React from 'react';
import {
  getFieldDisplayName,
  GrafanaTheme2,
  SelectableValue,
  TransformerRegistryItem,
  TransformerUIProps,
} from '@grafana/data';
import { configFromDataTransformer, ConfigFromQueryTransformOptions } from './configFromQuery';
import { IconButton, InlineField, InlineFieldRow, InlineLabel, Select, useStyles2, ValuePicker } from '@grafana/ui';
import { css } from '@emotion/css';
import { configMapHandlers } from '../rowsToFields/rowsToFields';
import { capitalize } from 'lodash';

interface Props extends TransformerUIProps<ConfigFromQueryTransformOptions> {}

export function ConfigFromQueryTransformerEditor({ input, onChange, options }: Props) {
  const styles = useStyles2(getStyles);

  const refIds = input
    .map((x) => x.refId)
    .filter((x) => x != null)
    .map((x) => ({ label: x, value: x }));

  const currentRefId = options.configRefId || 'config';
  const fieldNames: Array<SelectableValue<string>> = [];
  const configProps = getConfigProperties();

  for (const frame of input) {
    if (frame.refId === options.configRefId) {
      for (const field of frame.fields) {
        const fieldName = getFieldDisplayName(field, frame, input);
        fieldNames.push({ label: fieldName, value: fieldName });
      }
    }
  }

  const onRefIdChange = (value: SelectableValue<string>) => {
    onChange({
      ...options,
      configRefId: value.value || 'config',
    });
  };

  const onAddMapping = (value: SelectableValue<string>) => {
    onChange({
      ...options,
      mappings: [
        ...options.mappings,
        {
          fieldName: value.value!,
          configProperty: 'max',
        },
      ],
    });
  };

  const onChangeConfigProperty = (idx: number, value: SelectableValue<string>) => {
    const mappings = [...options.mappings];
    mappings.splice(idx, 1, {
      ...mappings[idx],
      configProperty: value.value!,
    });

    onChange({ ...options, mappings });
  };

  const onRemoveMapping = (idx: number) => {
    const mappings = [...options.mappings.slice(0, idx), ...options.mappings.slice(idx + 1)];
    onChange({ ...options, mappings });
  };

  return (
    <>
      <InlineFieldRow>
        <InlineField label="Select config query" labelWidth={20}>
          <Select onChange={onRefIdChange} options={refIds} value={currentRefId} width={20} />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineLabel width={20}>Field to config mapping</InlineLabel>
        <div className={styles.mappings}>
          {options.mappings.map((mapping, index: number) => (
            <InlineFieldRow key={index.toString()}>
              <InlineLabel width="auto">{mapping.fieldName}</InlineLabel>
              <InlineLabel width="auto">Map to</InlineLabel>
              <InlineField label="Configuration property">
                <Select
                  onChange={(value) => onChangeConfigProperty(index, value)}
                  options={configProps}
                  value={mapping.configProperty}
                />
              </InlineField>
              <InlineLabel>
                <IconButton
                  name="trash-alt"
                  size="sm"
                  onClick={() => onRemoveMapping(index)}
                  aria-label="remove mapping"
                />
              </InlineLabel>
            </InlineFieldRow>
          ))}
          <InlineField>
            <ValuePicker
              variant="secondary"
              size="md"
              label="Add manual mapping"
              options={fieldNames}
              onChange={onAddMapping}
            />
          </InlineField>
        </div>
      </InlineFieldRow>
    </>
  );
}

function getConfigProperties(): Array<SelectableValue<string>> {
  const options: Array<SelectableValue<string>> = [];

  for (const key of Object.keys(configMapHandlers)) {
    options.push({ label: capitalize(key), value: key });
  }

  return options;
}

const getStyles = (theme: GrafanaTheme2) => ({
  mappings: css`
    flex-grow: 1;
  `,
});

export const configFromQueryTransformRegistryItem: TransformerRegistryItem<ConfigFromQueryTransformOptions> = {
  id: configFromDataTransformer.id,
  editor: ConfigFromQueryTransformerEditor,
  transformation: configFromDataTransformer,
  name: configFromDataTransformer.name,
  description: configFromDataTransformer.description,
};
