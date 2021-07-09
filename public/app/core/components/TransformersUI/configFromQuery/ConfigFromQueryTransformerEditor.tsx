import React from 'react';
import {
  DataFrame,
  getFieldDisplayName,
  GrafanaTheme2,
  SelectableValue,
  TransformerRegistryItem,
  TransformerUIProps,
} from '@grafana/data';
import { configFromDataTransformer, ConfigFromQueryTransformOptions } from './configFromQuery';
import { InlineField, InlineFieldRow, InlineLabel, Select, useStyles2 } from '@grafana/ui';
import { css } from '@emotion/css';
import { configMapHandlers, lookUpConfigMapDefinition } from '../rowsToFields/configFromFrame';
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
  const configProps: Array<SelectableValue<string | undefined>> = configMapHandlers.map((def) => ({
    label: capitalize(def.key),
    value: def.key,
  }));

  let configFrame: DataFrame | null = null;

  for (const frame of input) {
    if (frame.refId === options.configRefId) {
      configFrame = frame;

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

  const onChangeConfigProperty = (fieldName: string, value: SelectableValue<string | undefined>) => {
    // Remove any mappings for fields that does not exist on configFrame and current edit
    const mappings = options.mappings.filter((map) => {
      return configFrame?.fields.find((field) => {
        const name = getFieldDisplayName(field, configFrame!);
        return name === map.fieldName && fieldName !== name;
      });
    });

    if (value.value) {
      mappings.push({ fieldName: fieldName, configProperty: value.value! });
    }

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
        <InlineLabel width={20}>Mappings</InlineLabel>
        {configFrame && (
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.headerCell}>Field name</th>
                <th className={styles.headerCell}>Maps to config</th>
              </tr>
            </thead>
            <tbody>
              {configFrame.fields.map((field) => {
                const fieldName = getFieldDisplayName(field, configFrame!);
                const def = lookUpConfigMapDefinition(fieldName, options.mappings);

                return (
                  <tr key={fieldName}>
                    <td className={styles.labelCell}>{fieldName}</td>
                    <td className={styles.selectCell}>
                      <Select
                        options={configProps}
                        value={def?.key}
                        onChange={(value) => onChangeConfigProperty(fieldName, value)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </InlineFieldRow>
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  mappings: css`
    flex-grow: 1;
  `,
  table: css`
    td,
    th {
      border-right: 4px solid ${theme.colors.background.primary};
      border-bottom: 4px solid ${theme.colors.background.primary};
      white-space: nowrap;
      min-width: 120px;
    }
  `,
  headerCell: css`
    background: ${theme.colors.background.secondary};
    font-size: ${theme.typography.bodySmall.fontSize};
    line-height: ${theme.spacing(4)};
    padding: ${theme.spacing(0, 1)};
  `,
  labelCell: css`
    background: ${theme.colors.background.secondary};
    padding: ${theme.spacing(0, 1)};
  `,
  selectCell: css`
    padding: 0;
  `,
});

export const configFromQueryTransformRegistryItem: TransformerRegistryItem<ConfigFromQueryTransformOptions> = {
  id: configFromDataTransformer.id,
  editor: ConfigFromQueryTransformerEditor,
  transformation: configFromDataTransformer,
  name: configFromDataTransformer.name,
  description: configFromDataTransformer.description,
};
