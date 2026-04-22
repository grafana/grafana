import { css } from '@emotion/css';
import { useId } from 'react';

import { type GrafanaTheme2, ReducerID, type TransformerUIProps } from '@grafana/data';
import {
  GroupByOperationID,
  type GroupToNestedTableMatcherConfig,
  type GroupToNestedTableTransformerOptions,
  type GroupToNestedTableTransformerOptionsV2,
  isV1GroupToNestedTableOptions,
  migrateGroupToNestedTableOptions,
  SHOW_NESTED_HEADERS_DEFAULT,
} from '@grafana/data/internal';
import { t } from '@grafana/i18n';
import {
  Alert,
  Button,
  Combobox,
  Field,
  fieldMatchersUI,
  useFieldMatchersOptions,
  IconButton,
  InlineField,
  Stack,
  StatsPicker,
  Switch,
  useTheme2,
} from '@grafana/ui';

import { appendNewRule, DEFAULT_MATCHER_ID, deleteRuleByIndex, getRuleKey, updateRuleByIndex } from './utils';

interface RuleRowProps {
  rule: GroupToNestedTableMatcherConfig;
  data: Parameters<typeof GroupToNestedTableTransformerEditorV2>[0]['input'];
  onChange: (rule: GroupToNestedTableMatcherConfig) => void;
  onDelete: () => void;
}

function getRuleKeys(rules: GroupToNestedTableMatcherConfig[]): string[] {
  const keys: string[] = [];
  const keyCounts: Record<string, number> = {};
  for (const rule of rules) {
    const baseKey = getRuleKey(rule);
    const count = keyCounts[baseKey] ?? 0;
    keyCounts[baseKey] = count + 1;
    keys.push(count === 0 ? baseKey : `${baseKey}:${count}`);
  }
  return keys;
}

const RuleRow = ({ rule, data, onChange, onDelete }: RuleRowProps) => {
  const theme = useTheme2();
  const styles = getStyles(theme);
  const matcherSelectId = useId();
  const matcherOptionsId = useId();
  const matcherOptions = useFieldMatchersOptions(true);

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

export const GroupToNestedTableTransformerEditorV2 = ({ input, options: rawOptions, onChange }: EditorProps) => {
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
            onChange={(rule) => onChange(updateRuleByIndex(options, index, rule))}
            onDelete={() => onChange(deleteRuleByIndex(options, index))}
          />
        ))}
      </Stack>

      <div>
        <Button icon="plus" onClick={() => onChange(appendNewRule(options))} variant="secondary" size="sm">
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
        <Switch
          value={showHeaders}
          onChange={() =>
            onChange({
              ...options,
              showSubframeHeaders:
                options.showSubframeHeaders === undefined ? !SHOW_NESTED_HEADERS_DEFAULT : !options.showSubframeHeaders,
            })
          }
        />
      </Field>
    </Stack>
  );
};

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
});
