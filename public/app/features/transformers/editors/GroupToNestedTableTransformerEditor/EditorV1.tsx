import { css } from '@emotion/css';
import { useCallback, useId } from 'react';

import { type GrafanaTheme2, ReducerID, type SelectableValue, type TransformerUIProps } from '@grafana/data';
import {
  type GroupByFieldOptions,
  GroupByOperationID,
  type GroupToNestedTableTransformerOptions,
  SHOW_NESTED_HEADERS_DEFAULT,
} from '@grafana/data/internal';
import { t } from '@grafana/i18n';
import { Alert, Field, InlineField, Select, Stack, StatsPicker, Switch, useTheme2 } from '@grafana/ui';

import { useAllFieldNamesFromDataFrames } from '../../utils';

interface FieldProps {
  fieldName: string;
  config?: GroupByFieldOptions;
  onConfigChange: (config: GroupByFieldOptions) => void;
}

export const GroupByFieldConfiguration = ({ fieldName, config: fieldConfig, onConfigChange }: FieldProps) => {
  const theme = useTheme2();
  const styles = getStyles(theme);
  const id = useId();
  const onChange = useCallback(
    (value: SelectableValue<GroupByOperationID | null>) => {
      onConfigChange({
        aggregations: fieldConfig?.aggregations ?? [],
        operation: value?.value ?? null,
      });
    },
    [fieldConfig, onConfigChange]
  );

  const operationOptions = [
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
    <InlineField className={styles.label} label={fieldName} grow shrink htmlFor={id}>
      <Stack gap={0.5} direction="row" wrap={false}>
        <div className={styles.operation}>
          <Select
            inputId={id}
            options={operationOptions}
            value={fieldConfig?.operation}
            placeholder={t('transformers.group-by-field-configuration.placeholder-ignored', 'Ignored')}
            onChange={onChange}
            isClearable
          />
        </div>

        {fieldConfig?.operation === GroupByOperationID.aggregate && (
          <StatsPicker
            placeholder={t('transformers.group-by-field-configuration.placeholder-select-stats', 'Select stats')}
            allowMultiple
            stats={fieldConfig.aggregations}
            onChange={(stats) => {
              onConfigChange({
                ...fieldConfig,
                aggregations: stats.filter((stat): stat is ReducerID => stat in ReducerID),
              });
            }}
          />
        )}
      </Stack>
    </InlineField>
  );
};

export const GroupToNestedTableTransformerEditorV1 = ({
  input,
  options,
  onChange,
}: TransformerUIProps<GroupToNestedTableTransformerOptions>) => {
  const fieldNames = useAllFieldNamesFromDataFrames(input);
  const showHeaders =
    options.showSubframeHeaders === undefined ? SHOW_NESTED_HEADERS_DEFAULT : options.showSubframeHeaders;

  const onConfigChange = useCallback(
    (fieldName: string) => (fieldConfig: GroupByFieldOptions) => {
      onChange({
        ...options,
        fields: {
          ...options.fields,
          [fieldName]: fieldConfig,
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
    <Stack gap={1} direction="column">
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
        noMargin
      >
        <Switch value={showHeaders} onChange={onShowFieldNamesChange} />
      </Field>
    </Stack>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  label: css({
    minWidth: theme.spacing(32),
  }),
  operation: css({
    flexShrink: 0,
    height: '100%',
    width: theme.spacing(24),
  }),
});
