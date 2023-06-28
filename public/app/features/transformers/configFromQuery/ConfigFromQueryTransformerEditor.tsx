import { css } from '@emotion/css';
import React from 'react';

import {
  FieldMatcherID,
  GrafanaTheme2,
  PluginState,
  SelectableValue,
  TransformerRegistryItem,
  TransformerUIProps,
  TransformerCategory,
} from '@grafana/data';
import { fieldMatchersUI, InlineField, InlineFieldRow, Select, useStyles2 } from '@grafana/ui';

import { FieldToConfigMappingEditor } from '../fieldToConfigMapping/FieldToConfigMappingEditor';

import { configFromDataTransformer, ConfigFromQueryTransformOptions } from './configFromQuery';

export interface Props extends TransformerUIProps<ConfigFromQueryTransformOptions> {}

export function ConfigFromQueryTransformerEditor({ input, onChange, options }: Props) {
  const styles = useStyles2(getStyles);

  const refIds = input
    .map((x) => x.refId)
    .filter((x) => x != null)
    .map((x) => ({ label: x, value: x }));

  const currentRefId = options.configRefId || 'config';
  const currentMatcher = options.applyTo ?? { id: FieldMatcherID.byType, options: 'number' };
  const matcherUI = fieldMatchersUI.get(currentMatcher.id);
  const configFrame = input.find((x) => x.refId === currentRefId);

  const onRefIdChange = (value: SelectableValue<string>) => {
    onChange({
      ...options,
      configRefId: value.value || 'config',
    });
  };

  const onMatcherChange = (value: SelectableValue<string>) => {
    onChange({ ...options, applyTo: { id: value.value! } });
  };

  const onMatcherConfigChange = (matcherOption: any) => {
    onChange({ ...options, applyTo: { id: currentMatcher.id, options: matcherOption } });
  };

  const matchers = fieldMatchersUI
    .list()
    .filter((o) => !o.excludeFromPicker)
    .map<SelectableValue<string>>((i) => ({ label: i.name, value: i.id, description: i.description }));

  return (
    <>
      <InlineFieldRow>
        <InlineField label="Config query" labelWidth={20}>
          <Select onChange={onRefIdChange} options={refIds} value={currentRefId} width={30} />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField label="Apply to" labelWidth={20}>
          <Select onChange={onMatcherChange} options={matchers} value={currentMatcher.id} width={30} />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField label="Apply to options" labelWidth={20} className={styles.matcherOptions}>
          <matcherUI.component
            matcher={matcherUI.matcher}
            data={input}
            options={currentMatcher.options}
            onChange={onMatcherConfigChange}
          />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        {configFrame && (
          <FieldToConfigMappingEditor
            frame={configFrame}
            mappings={options.mappings}
            onChange={(mappings) => onChange({ ...options, mappings })}
            withReducers
          />
        )}
      </InlineFieldRow>
    </>
  );
}

export const configFromQueryTransformRegistryItem: TransformerRegistryItem<ConfigFromQueryTransformOptions> = {
  id: configFromDataTransformer.id,
  editor: ConfigFromQueryTransformerEditor,
  transformation: configFromDataTransformer,
  name: configFromDataTransformer.name,
  description: configFromDataTransformer.description,
  state: PluginState.beta,
  categories: new Set([TransformerCategory.CalculateNewFields]),
  help: `
### Use cases

This transformation allows you select one query and from it extract standard options such as
**Min**, **Max**, **Unit**, and **Thresholds** and apply them to other query results.
This enables dynamic query driven visualization configuration.

### Options

- **Config query**: Selet the query that returns the data you want to use as configuration.
- **Apply to**: Select what fields or series to apply the configuration to.
- **Apply to options**: Usually a field type or field name regex depending on what option you selected in **Apply to**.

### Field mapping table

Below the configuration listed above you will find the field table. Here all fields found in the data returned by the config query will be listed along with a **Use as** and **Select** option. This table gives you control over what field should be mapped to which config property and if there are multiple rows which value to select.

## Example

Input[0] (From query: A, name: ServerA)

| Time          | Value |
| ------------- | ----- |
| 1626178119127 | 10    |
| 1626178119129 | 30    |

Input[1] (From query: B)

| Time          | Value |
| ------------- | ----- |
| 1626178119127 | 100   |
| 1626178119129 | 100   |

Output (Same as Input[0] but now with config on the Value field)

| Time          | Value (config: Max=100) |
| ------------- | ----------------------- |
| 1626178119127 | 10                      |
| 1626178119129 | 30                      |

Each row in the source data becomes a separate field. Each field now also has a maximum
configuration option set. Options such as **min**, **max**, **unit**, and **thresholds** are all part of field configuration, and if they are set like this, they will be used by the visualization instead of any options that are manually configured.
in the panel editor options pane.

## Value mappings

You can also transform a query result into value mappings. This is is a bit different because every
row in the configuration query result is used to define a single value mapping row. See the following example.

Config query result:

| Value | Text   | Color |
| ----- | ------ | ----- |
| L     | Low    | blue  |
| M     | Medium | green |
| H     | High   | red   |

In the field mapping specify:

| Field | Use as                  | Select     |
| ----- | ----------------------- | ---------- |
| Value | Value mappings / Value  | All values |
| Text  | Value mappings / Text   | All values |
| Color | Value mappings / Ciolor | All values |

Grafana will build the value mappings from you query result and apply it the the real data query results. You should see values being mapped and colored according to the config query results.
`,
};

const getStyles = (theme: GrafanaTheme2) => ({
  matcherOptions: css`
    min-width: 404px;
  `,
});
