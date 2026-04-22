import { css } from '@emotion/css';
import { useCallback, useId } from 'react';

import {
  DataTransformerID,
  type GrafanaTheme2,
  FieldMatcherID,
  PluginState,
  type ReducerID,
  type SelectableValue,
  standardTransformers,
  TransformerCategory,
  type TransformerRegistryItem,
  type TransformerUIProps,
} from '@grafana/data';
import {
  type GroupByFieldOptions,
  GroupByOperationID,
  type GroupToNestedTableMatcherConfig,
  type GroupToNestedTableTransformerOptions,
  type GroupToNestedTableTransformerOptionsV2,
  isV1GroupToNestedTableOptions,
  migrateGroupToNestedTableOptions,
  SHOW_NESTED_HEADERS_DEFAULT,
} from '@grafana/data/internal';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import {
  Alert,
  Button,
  Combobox,
  Field,
  fieldMatchersUI,
  useFieldMatchersOptions,
  IconButton,
  InlineField,
  Select,
  Stack,
  StatsPicker,
  Switch,
  useTheme2,
} from '@grafana/ui';

import darkImage from '../images/dark/groupToNestedTable.svg';
import lightImage from '../images/light/groupToNestedTable.svg';
import { useAllFieldNamesFromDataFrames } from '../utils';

// ---------------------------------------------------------------------------
// V1 (legacy) editor — unchanged from original
// ---------------------------------------------------------------------------

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
              onConfigChange({ ...fieldConfig, aggregations: stats.filter((stat): stat is ReducerID => stat in ReducerID) });
            }}
          />
        )}
      </Stack>
    </InlineField>
  );
};

// ---------------------------------------------------------------------------
// V2 editor — matcher-based rule list
// ---------------------------------------------------------------------------

const DEFAULT_MATCHER_ID = FieldMatcherID.byName;

// Stable key derived from rule content so React doesn't confuse sibling RuleRows
// when one is deleted. Uses the matcher identity rather than array position.
// For the rare case of two rules with identical matcher configs the occurrence
// count is appended so each key remains unique.
const getRuleKeys = (rules: GroupToNestedTableMatcherConfig[]): string[] => {
  const seen = new Map<string, number>();
  return rules.map((rule) => {
    const base = `${rule.matcher.id}:${JSON.stringify(rule.matcher.options ?? '')}`;
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base}:${count}`;
  });
};

interface RuleRowProps {
  rule: GroupToNestedTableMatcherConfig;
  data: Parameters<typeof GroupToNestedTableTransformerEditorV2>[0]['input'];
  onChange: (rule: GroupToNestedTableMatcherConfig) => void;
  onDelete: () => void;
}

const RuleRow = ({ rule, data, onChange, onDelete }: RuleRowProps) => {
  const theme = useTheme2();
  const styles = getStyles(theme);
  const matcherSelectId = useId();
  const matcherOptionsId = useId();
  const matcherOptions = useFieldMatchersOptions(true);

  // Resolve the UI component for the current matcher type
  const matcherUI = fieldMatchersUI.getIfExists(rule.matcher.id) ?? fieldMatchersUI.get(DEFAULT_MATCHER_ID);

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
    <div className={styles.ruleRow}>
      {/* Row 1, Col 1: matcher type */}
      <Combobox
        id={matcherSelectId}
        options={matcherOptions}
        value={rule.matcher.id}
        onChange={(value) => {
          onChange({ ...rule, matcher: { id: value.value } });
        }}
        aria-label={t('transformers.group-to-nested-table.aria-label-matcher-type', 'Select matcher type')}
      />

      {/* Row 1, Col 2: matcher sub-options (field name picker, type picker, regex input, etc.) */}
      <matcherUI.component
        id={matcherOptionsId}
        matcher={matcherUI.matcher}
        data={data}
        options={rule.matcher.options}
        onChange={(matcherOption) => {
          onChange({ ...rule, matcher: { id: rule.matcher.id, options: matcherOption } });
        }}
      />

      {/* Row 1, Col 3: operation */}
      <Combobox
        options={operationOptions}
        value={rule.operation}
        placeholder={t('transformers.group-to-nested-table.placeholder', 'Select operation')}
        onChange={(value) => {
          onChange({ ...rule, operation: value?.value ?? null });
        }}
        isClearable
        aria-label={t('transformers.group-to-nested-table.aria-label-operation', 'Select operation')}
      />

      {/* Row 1, Col 4: delete */}
      <div className={styles.deleteCell}>
        <IconButton
          name="trash-alt"
          onClick={onDelete}
          tooltip={t('transformers.group-to-nested-table.aria-label-remove-rule', 'Remove rule')}
          aria-label={t('transformers.group-to-nested-table.aria-label-remove-rule', 'Remove rule')}
        />
      </div>

      {/* Row 2: aggregation options (only when operation is aggregate) */}
      {rule.operation === GroupByOperationID.aggregate && (
        <div className={styles.calculationSection}>
          <InlineField
            className={styles.inlineField}
            grow
            label={t('transformers.group-to-nested-table.label-calculations', 'Calculation(s)')}
          >
            <StatsPicker
              placeholder={t(
                'transformers.group-by-field-configuration.placeholder-calculations',
                'Select calculation(s)'
              )}
              allowMultiple
              stats={rule.aggregations}
              onChange={(stats: string[]) => {
                onChange({ ...rule, aggregations: stats.filter((stat): stat is ReducerID => stat in ReducerID) });
              }}
            />
          </InlineField>

          <InlineField
            className={styles.inlineField}
            label={t('transformers.group-to-nested-table.label-keep-nested-field', 'Keep nested field(s)')}
            tooltip={t(
              'transformers.group-to-nested-table.tooltip-keep-nested-field',
              'When enabled, the raw field values are also retained in the nested sub-table alongside the aggregated column.'
            )}
          >
            <Switch
              value={rule.keepNestedField === true}
              onChange={() => {
                onChange({ ...rule, keepNestedField: !rule.keepNestedField });
              }}
            />
          </InlineField>
        </div>
      )}
    </div>
  );
};

type EditorProps = TransformerUIProps<GroupToNestedTableTransformerOptions | GroupToNestedTableTransformerOptionsV2>;

const GroupToNestedTableTransformerEditorV2 = ({ input, options: rawOptions, onChange }: EditorProps) => {
  // Always work internally in V2 shape
  const options: GroupToNestedTableTransformerOptionsV2 = isV1GroupToNestedTableOptions(rawOptions)
    ? migrateGroupToNestedTableOptions(rawOptions)
    : rawOptions;

  const showHeaders =
    options.showSubframeHeaders === undefined ? SHOW_NESTED_HEADERS_DEFAULT : options.showSubframeHeaders;

  const hasGrouping = options.rules.some((r) => r.operation === GroupByOperationID.groupBy);
  const hasAggregation = options.rules.some(
    (r) => r.operation === GroupByOperationID.aggregate && r.aggregations.length > 0
  );
  const showCalcAlert = hasAggregation && !hasGrouping;

  const onRuleChange = useCallback(
    (index: number) => (rule: GroupToNestedTableMatcherConfig) => {
      const rules = [...options.rules];
      rules[index] = rule;
      onChange({ ...options, rules });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onChange, options.rules]
  );

  const onRuleDelete = useCallback(
    (index: number) => () => {
      const rules = options.rules.filter((_, i) => i !== index);
      onChange({ ...options, rules });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onChange, options.rules]
  );

  const onAddRule = useCallback(() => {
    onChange({
      ...options,
      rules: [
        ...options.rules,
        {
          matcher: { id: DEFAULT_MATCHER_ID },
          operation: null,
          aggregations: [],
          keepNestedField: true,
        },
      ],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onChange, options.rules]);

  const onShowFieldNamesChange = useCallback(() => {
    onChange({
      ...options,
      showSubframeHeaders:
        options.showSubframeHeaders === undefined ? !SHOW_NESTED_HEADERS_DEFAULT : !options.showSubframeHeaders,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onChange, options.showSubframeHeaders]);

  return (
    <Stack gap={1.5} direction="column">
      {showCalcAlert && (
        <Alert
          title={t(
            'transformers.group-to-nested-table-transformer-editor.title-calc-alert',
            'Calculations will not have an effect if no fields are being grouped on.'
          )}
          severity="warning"
        />
      )}

      <Stack gap={1.5} direction="column">
        {getRuleKeys(options.rules).map((key, index) => (
          <RuleRow
            key={key}
            rule={options.rules[index]}
            data={input}
            onChange={onRuleChange(index)}
            onDelete={onRuleDelete(index)}
          />
        ))}
      </Stack>

      <div>
        <Button icon="plus" onClick={onAddRule} variant="secondary" size="sm">
          {t('transformers.group-to-nested-table.button-add-rule', 'Add rule')}
        </Button>
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

// ---------------------------------------------------------------------------
// Top-level editor — switches between V1 and V2 based on feature toggle
// ---------------------------------------------------------------------------

export const GroupToNestedTableTransformerEditor = ({
  input,
  options,
  onChange,
}: TransformerUIProps<GroupToNestedTableTransformerOptions | GroupToNestedTableTransformerOptionsV2>) => {
  // if the config is already saved in v2 format, show the new editor to avoid issues.
  if (config.featureToggles.groupToNestedTableV2 || !isV1GroupToNestedTableOptions(options)) {
    return <GroupToNestedTableTransformerEditorV2 input={input} options={options} onChange={onChange} />;
  }

  // V1 editor: options will be V1 shape when toggle is off (or freshly created panels)
  // Cast is safe because without the toggle, the transformer always produces V1 options.
  return <GroupToNestedTableTransformerEditorV1 input={input} options={options} onChange={onChange} />;
};

// ---------------------------------------------------------------------------
// V1 (legacy) top-level editor component — original implementation
// ---------------------------------------------------------------------------

const GroupToNestedTableTransformerEditorV1 = ({
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

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const getStyles = (theme: GrafanaTheme2) => ({
  ruleRow: css({
    display: 'grid',
    gridTemplateColumns: '30% 30% 30% 10%',
    columnGap: theme.spacing(0.5),
    rowGap: theme.spacing(0.5),
    alignItems: 'center',
    containerType: 'inline-size',
  }),
  calculationSection: css({
    gridColumn: 'span 3',
    gridRow: 'span 2',
    paddingLeft: theme.spacing(1),
    borderLeft: `${theme.spacing(0.25)} solid ${theme.colors.border.weak}`,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.5),
    [theme.breakpoints.container.up(500)]: {
      gridColumn: 'span 2',
    },
  }),
  inlineField: css({
    display: 'flex',
    alignItems: 'center',
    margin: 0,
  }),
  deleteCell: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginLeft: theme.spacing(0.5),
  }),
  // v1 only
  label: css({
    minWidth: theme.spacing(32),
  }),
  operation: css({
    flexShrink: 0,
    height: '100%',
    width: theme.spacing(24),
  }),
});

// ---------------------------------------------------------------------------
// Registry item factory
// ---------------------------------------------------------------------------

export const getGroupToNestedTableTransformRegistryItem: () => TransformerRegistryItem<
  GroupToNestedTableTransformerOptions | GroupToNestedTableTransformerOptionsV2
> = () => ({
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
