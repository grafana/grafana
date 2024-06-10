import { css } from '@emotion/css';
import React, { useCallback } from 'react';

import {
  DataTransformerID,
  ReducerID,
  SelectableValue,
  standardTransformers,
  TransformerRegistryItem,
  TransformerUIProps,
  TransformerCategory,
  GrafanaTheme2,
} from '@grafana/data';
import {
  GroupByFieldOptions,
  GroupByOperationID,
  GroupByTransformerOptions,
} from '@grafana/data/src/transformations/transformers/groupBy';
import {
  GroupToNestedTableTransformerOptions,
  SHOW_NESTED_HEADERS_DEFAULT,
} from '@grafana/data/src/transformations/transformers/groupToNestedTable';
import { Stack } from '@grafana/experimental';
import { useTheme2, Select, StatsPicker, InlineField, Field, Switch, Alert } from '@grafana/ui';

import { useAllFieldNamesFromDataFrames } from '../utils';

interface FieldProps {
  fieldName: string;
  config?: GroupByFieldOptions;
  onConfigChange: (config: GroupByFieldOptions) => void;
}

export const GroupToNestedTableTransformerEditor = ({
  input,
  options,
  onChange,
}: TransformerUIProps<GroupToNestedTableTransformerOptions>) => {
  const fieldNames = useAllFieldNamesFromDataFrames(input);
  const showHeaders =
    options.showSubframeHeaders === undefined ? SHOW_NESTED_HEADERS_DEFAULT : options.showSubframeHeaders;

  const onConfigChange = useCallback(
    (fieldName: string) => (config: GroupByFieldOptions) => {
      onChange({
        ...options,
        fields: {
          ...options.fields,
          [fieldName]: config,
        },
      });
    },
    // Adding options to the dependency array causes infinite loop here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onChange]
  );

  const onShowFieldNamesChange = useCallback(
    () => {
      const showSubframeHeaders =
        options.showSubframeHeaders === undefined ? !SHOW_NESTED_HEADERS_DEFAULT : !options.showSubframeHeaders;

      onChange({
        showSubframeHeaders,
        fields: {
          ...options.fields,
        },
      });
    },
    // Adding options to the dependency array causes infinite loop here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onChange]
  );

  // See if there's both an aggregation and grouping field configured
  // for calculations. If not we display a warning because there
  // needs to be a grouping for the calculation to have effect
  let hasGrouping,
    hasAggregation = false;
  for (const field of Object.values(options.fields)) {
    if (field.aggregations.length > 0 && field.operation !== null) {
      hasAggregation = true;
    }
    if (field.operation === GroupByOperationID.groupBy) {
      hasGrouping = true;
    }
  }
  const showCalcAlert = hasAggregation && !hasGrouping;

  return (
    <Stack direction="column">
      {showCalcAlert && (
        <Alert title="Calculations will not have an effect if no fields are being grouped on." severity="warning" />
      )}
      <div>
        {fieldNames.map((key) => (
          <GroupByFieldConfiguration
            onConfigChange={onConfigChange(key)}
            fieldName={key}
            config={options.fields[key]}
            key={key}
          />
        ))}
      </div>
      <Field
        label="Show field names in nested tables"
        description="If enabled nested tables will show field names as a table header"
      >
        <Switch value={showHeaders} onChange={onShowFieldNamesChange} />
      </Field>
    </Stack>
  );
};

const options = [
  { label: 'Group by', value: GroupByOperationID.groupBy },
  { label: 'Calculate', value: GroupByOperationID.aggregate },
];

export const GroupByFieldConfiguration = ({ fieldName, config, onConfigChange }: FieldProps) => {
  const theme = useTheme2();
  const styles = getStyles(theme);

  const onChange = useCallback(
    (value: SelectableValue<GroupByOperationID | null>) => {
      onConfigChange({
        aggregations: config?.aggregations ?? [],
        operation: value?.value ?? null,
      });
    },
    [config, onConfigChange]
  );

  return (
    <InlineField className={styles.label} label={fieldName} grow shrink>
      <Stack gap={0.5} direction="row" wrap={false}>
        <div className={styles.operation}>
          <Select options={options} value={config?.operation} placeholder="Ignored" onChange={onChange} isClearable />
        </div>

        {config?.operation === GroupByOperationID.aggregate && (
          <StatsPicker
            className={styles.aggregations}
            placeholder="Select Stats"
            allowMultiple
            stats={config.aggregations}
            onChange={(stats) => {
              // eslint-disable-next-line
              onConfigChange({ ...config, aggregations: stats as ReducerID[] });
            }}
          />
        )}
      </Stack>
    </InlineField>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    label: css({
      minWidth: theme.spacing(32),
    }),
    operation: css({
      flexShrink: 0,
      height: '100%',
      width: theme.spacing(24),
    }),
    aggregations: css({
      flexGrow: 1,
    }),
  };
};

export const groupToNestedTableTransformRegistryItem: TransformerRegistryItem<GroupByTransformerOptions> = {
  id: DataTransformerID.groupToNestedTable,
  editor: GroupToNestedTableTransformerEditor,
  transformation: standardTransformers.groupToNestedTable,
  name: standardTransformers.groupToNestedTable.name,
  description: standardTransformers.groupToNestedTable.description,
  categories: new Set([
    TransformerCategory.Combine,
    TransformerCategory.CalculateNewFields,
    TransformerCategory.Reformat,
  ]),
};
