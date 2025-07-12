import { css } from '@emotion/css';
import { useCallback } from 'react';

import {
  DataTransformerID,
  ReducerID,
  SelectableValue,
  standardTransformers,
  TransformerRegistryItem,
  TransformerUIProps,
  TransformerCategory,
  GrafanaTheme2,
  PluginState,
} from '@grafana/data';
import {
  GroupByFieldOptions,
  GroupByOperationID,
  GroupByTransformerOptions,
  GroupToNestedTableTransformerOptions,
  SHOW_NESTED_HEADERS_DEFAULT,
} from '@grafana/data/internal';
import { t } from '@grafana/i18n';
import { useTheme2, Select, StatsPicker, InlineField, Field, Switch, Alert, Stack } from '@grafana/ui';

import darkImage from '../images/dark/groupToNestedTable.svg';
import lightImage from '../images/light/groupToNestedTable.svg';
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
        <Alert
          title={t(
            'transformers.group-to-nested-table-transformer-editor.title-calc-alert',
            'Calculations will not have an effect if no fields are being grouped on.'
          )}
          severity="warning"
        />
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
        label={t(
          'transformers.group-to-nested-table-transformer-editor.label-show-field-names-in-nested-tables',
          'Show field names in nested tables'
        )}
        description={t(
          'transformers.group-to-nested-table-transformer-editor.description-show-field-names',
          'If enabled nested tables will show field names as a table header'
        )}
      >
        <Switch value={showHeaders} onChange={onShowFieldNamesChange} />
      </Field>
    </Stack>
  );
};

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

  const options = [
    {
      label: t('transformers.group-by-field-configuration.options.label.group-by', 'Group by'),
      value: GroupByOperationID.groupBy,
    },
    {
      label: t('transformers.group-by-field-configuration.options.label.calculate', 'Calculate'),
      value: GroupByOperationID.aggregate,
    },
  ];

  return (
    <InlineField className={styles.label} label={fieldName} grow shrink>
      <Stack gap={0.5} direction="row" wrap={false}>
        <div className={styles.operation}>
          <Select
            options={options}
            value={config?.operation}
            placeholder={t('transformers.group-by-field-configuration.placeholder-ignored', 'Ignored')}
            onChange={onChange}
            isClearable
          />
        </div>

        {config?.operation === GroupByOperationID.aggregate && (
          <StatsPicker
            className={styles.aggregations}
            placeholder={t('transformers.group-by-field-configuration.placeholder-select-stats', 'Select stats')}
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

export const getGroupToNestedTableTransformRegistryItem: () => TransformerRegistryItem<GroupByTransformerOptions> =
  () => ({
    id: DataTransformerID.groupToNestedTable,
    editor: GroupToNestedTableTransformerEditor,
    transformation: standardTransformers.groupToNestedTable,
    name: t(
      'transformers.group-to-nested-table-transformer-editor.name.group-to-nested-tables',
      'Group to nested tables'
    ),
    description: t(
      'transformers.group-to-nested-table-transformer-editor.description.group-by-field-value',
      'Group data by a field value and create nested tables with the grouped data.'
    ),
    categories: new Set([
      TransformerCategory.Combine,
      TransformerCategory.CalculateNewFields,
      TransformerCategory.Reformat,
    ]),
    state: PluginState.beta,
    imageDark: darkImage,
    imageLight: lightImage,
  });
