import { css } from '@emotion/css';
import { useCallback } from 'react';

import {
  DataTransformerID,
  ReducerID,
  standardTransformers,
  TransformerRegistryItem,
  TransformerUIProps,
  TransformerCategory,
  GrafanaTheme2,
} from '@grafana/data';
import { GroupByFieldOptions, GroupByOperationID, GroupByTransformerOptions } from '@grafana/data/internal';
import { t } from '@grafana/i18n';
import { useTheme2, StatsPicker, InlineField, Stack, Alert, Combobox, ComboboxOption } from '@grafana/ui';

import { getTransformationContent } from '../docs/getTransformationContent';
import darkImage from '../images/dark/groupBy.svg';
import lightImage from '../images/light/groupBy.svg';
import { DataFieldsErrorWrapper } from '../utils';

interface FieldProps {
  fieldName: string;
  config?: GroupByFieldOptions;
  onConfigChange: (config: GroupByFieldOptions) => void;
}

interface GroupByTransformerEditorProps extends TransformerUIProps<GroupByTransformerOptions> {
  fieldNames: string[];
}

export const GroupByTransformerEditorBase = ({ options, onChange, fieldNames }: GroupByTransformerEditorProps) => {
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
            'transformers.group-by-transformer-editor.title-calc-alert',
            'Calculations will not have an effect if no fields are being grouped on'
          )}
          severity="warning"
        />
      )}
      {fieldNames.map((key) => (
        <GroupByFieldConfiguration
          onConfigChange={onConfigChange(key)}
          fieldName={key}
          config={options.fields[key]}
          key={key}
        />
      ))}
    </Stack>
  );
};

const GroupByTransformerEditor = DataFieldsErrorWrapper(GroupByTransformerEditorBase, {
  withBaseFieldNames: true,
});

const GroupByFieldConfiguration = ({ fieldName, config, onConfigChange }: FieldProps) => {
  const theme = useTheme2();

  const styles = getStyles(theme);

  const onChange = useCallback(
    (option: ComboboxOption<GroupByOperationID> | null) => {
      onConfigChange({
        aggregations: config?.aggregations ?? [],
        operation: option?.value ?? null,
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
      <Stack gap={0.5} direction="row">
        <div className={styles.operation}>
          <Combobox
            options={options}
            value={config?.operation}
            placeholder={t('transformers.group-by-field-configuration.placeholder-ignored', 'Ignored')}
            onChange={onChange}
            isClearable
          />
        </div>

        {config?.operation && (
          <StatsPicker
            className={styles.aggregations}
            placeholder={t('transformers.group-by-field-configuration.placeholder-select-stats', 'Select stats')}
            allowMultiple
            stats={config.aggregations}
            onChange={(stats: string[]) => {
              onConfigChange({ ...config, aggregations: stats.filter((stat): stat is ReducerID => stat in ReducerID) });
            }}
            filterOptions={(option) =>
              config?.operation === GroupByOperationID.groupBy ? option.id === ReducerID.count : true
            }
          />
        )}
      </Stack>
    </InlineField>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    label: css({
      label: {
        minWidth: theme.spacing(32),
      },
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

export const getGroupByTransformRegistryItem: () => TransformerRegistryItem<GroupByTransformerOptions> = () => ({
  id: DataTransformerID.groupBy,
  editor: GroupByTransformerEditor,
  transformation: standardTransformers.groupByTransformer,
  name: t('transformers.group-by-transformer-editor.name.group-by', 'Group by'),
  description: t(
    'transformers.group-by-transformer-editor.description.group-series-by-field-calculate-stats',
    'Group data by a field value and create aggregate data.'
  ),
  categories: new Set([
    TransformerCategory.Combine,
    TransformerCategory.CalculateNewFields,
    TransformerCategory.Reformat,
  ]),
  help: getTransformationContent(DataTransformerID.groupBy).helperDocs,
  imageDark: darkImage,
  imageLight: lightImage,
});
