import { css } from '@emotion/css';
import { memo } from 'react';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Checkbox, Combobox, ComboboxOption, Icon, MultiCombobox, Tooltip, useStyles2 } from '@grafana/ui';

// Group header component
interface GroupHeaderProps {
  group: string;
  isOpen: boolean;
  onToggle: (group: string, isOpen: boolean) => void;
}

export const GroupHeader = memo(({ group, isOpen, onToggle }: GroupHeaderProps) => {
  const styles = useStyles2(getGroupStyles);

  return (
    <div className={styles.groupRow}>
      <button
        type="button"
        className={styles.groupButton}
        aria-expanded={isOpen}
        onClick={() => onToggle(group, !isOpen)}
      >
        <span className={styles.groupButtonInner}>
          <Icon name={isOpen ? 'angle-down' : 'angle-right'} />
          <span className={styles.groupLabel}>{group}</span>
        </span>
      </button>
    </div>
  );
});

GroupHeader.displayName = 'GroupHeader';

// Filter row component
interface FilterRowProps {
  keyOption: SelectableValue<string>;
  keyValue: string;
  operatorValue: string;
  isMultiOperator: boolean;
  singleValue: string;
  multiValues: string[];
  isGroupBy: boolean;
  isOrigin: boolean;
  hasGroupByVariable: boolean;
  operatorOptions: Array<ComboboxOption<string>>;
  onOperatorChange: (key: string, operator: string) => void;
  onSingleValueChange: (key: string, value: string) => void;
  onMultiValuesChange: (key: string, values: string[]) => void;
  onGroupByToggle: (key: string, nextValue: boolean) => void;
  getValueOptions: (key: string, operator: string, inputValue: string) => Promise<Array<ComboboxOption<string>>>;
}

export const FilterRow = memo(
  ({
    keyOption,
    keyValue,
    operatorValue,
    isMultiOperator,
    singleValue,
    multiValues,
    isGroupBy,
    isOrigin,
    hasGroupByVariable,
    operatorOptions,
    onOperatorChange,
    onSingleValueChange,
    onMultiValuesChange,
    onGroupByToggle,
    getValueOptions,
  }: FilterRowProps) => {
    const styles = useStyles2(getRowStyles);
    const label = keyOption.label ?? keyValue;

    return (
      <div className={styles.row}>
        {/* Label cell */}
        <div className={styles.labelCell}>
          <Tooltip content={label}>
            <span className={styles.labelShell}>
              <span className={styles.labelText}>{label}</span>
            </span>
          </Tooltip>
        </div>

        {/* Operator cell */}
        <div className={styles.operatorCell}>
          <Combobox
            aria-label={t('dashboard.filters-overview.operator', 'Operator')}
            options={operatorOptions}
            value={operatorValue}
            placeholder={t('dashboard.filters-overview.operator.placeholder', 'Select operator')}
            disabled={isOrigin}
            onChange={(option: ComboboxOption<string>) => {
              if (option?.value) {
                onOperatorChange(keyValue, option.value);
              }
            }}
          />
        </div>

        {/* Value cell */}
        <div className={styles.valueCell}>
          {isMultiOperator ? (
            <MultiCombobox
              aria-label={t('dashboard.filters-overview.value', 'Value')}
              options={(inputValue: string) => getValueOptions(keyValue, operatorValue, inputValue)}
              value={multiValues}
              placeholder={t('dashboard.filters-overview.value.placeholder', 'Select values')}
              isClearable={true}
              onChange={(selections: Array<ComboboxOption<string>>) => {
                onMultiValuesChange(
                  keyValue,
                  selections.map((s) => s.value)
                );
              }}
            />
          ) : (
            <Combobox
              aria-label={t('dashboard.filters-overview.value', 'Value')}
              options={(inputValue: string) => getValueOptions(keyValue, operatorValue, inputValue)}
              value={singleValue ? { label: singleValue, value: singleValue } : null}
              placeholder={t('dashboard.filters-overview.value.placeholder', 'Select value')}
              isClearable={true}
              onChange={(selection: ComboboxOption<string> | null) => {
                onSingleValueChange(keyValue, selection?.value ?? '');
              }}
            />
          )}
        </div>

        {/* GroupBy cell */}
        {hasGroupByVariable && (
          <div className={styles.groupByCell}>
            <Checkbox
              value={isGroupBy}
              label={t('dashboard.filters-overview.groupby', 'GroupBy')}
              onChange={() => onGroupByToggle(keyValue, !isGroupBy)}
            />
          </div>
        )}
      </div>
    );
  }
);

FilterRow.displayName = 'FilterRow';

// Styles
const getGroupStyles = (theme: GrafanaTheme2) => ({
  groupRow: css({
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    padding: theme.spacing(1, 0.5),
  }),
  groupButton: css({
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    background: 'transparent',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    color: 'inherit',
    textAlign: 'left',
  }),
  groupButtonInner: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
  }),
  groupLabel: css({
    fontWeight: theme.typography.fontWeightMedium,
  }),
});

const getRowStyles = (theme: GrafanaTheme2) => ({
  row: css({
    display: 'flex',
    alignItems: 'flex-start',
    gap: 0,
    width: '100%',
  }),
  labelCell: css({
    flex: '1 1 auto',
    minWidth: 0,
  }),
  operatorCell: css({
    flex: '0 0 auto',
    width: theme.spacing(8),
    '& > *': {
      width: '100%',
      paddingLeft: 0,
      paddingRight: 0,
      borderRadius: '0 !important',
      '& input': {
        borderRadius: '0 !important',
      },
    },
  }),
  valueCell: css({
    flex: '0 0 auto',
    width: theme.spacing(26),
    '& > *': {
      width: '100%',
      paddingLeft: 0,
      borderTopLeftRadius: '0 !important',
      borderBottomLeftRadius: '0 !important',
      borderTopRightRadius: `${theme.shape.radius.default} !important`,
      borderBottomRightRadius: `${theme.shape.radius.default} !important`,
      '& input': {
        borderTopLeftRadius: '0 !important',
        borderBottomLeftRadius: '0 !important',
        borderTopRightRadius: `${theme.shape.radius.default} !important`,
        borderBottomRightRadius: `${theme.shape.radius.default} !important`,
      },
      // MultiCombobox: container > wrapper (has border radius)
      '& > *': {
        borderTopLeftRadius: '0 !important',
        borderBottomLeftRadius: '0 !important',
        borderTopRightRadius: `${theme.shape.radius.default} !important`,
        borderBottomRightRadius: `${theme.shape.radius.default} !important`,
      },
    },
  }),
  groupByCell: css({
    flex: '0 0 auto',
    width: theme.spacing(10),
    display: 'flex',
    alignItems: 'center',
    alignSelf: 'center',
    marginLeft: theme.spacing(1),
  }),
  labelShell: css({
    display: 'flex',
    alignItems: 'center',
    paddingLeft: theme.spacing(1),
    paddingRight: 0,
    fontWeight: theme.typography.fontWeightMedium,
    fontSize: theme.typography.size.sm,
    backgroundColor: theme.colors.background.secondary,
    height: theme.spacing(theme.components.height.md),
    lineHeight: theme.spacing(theme.components.height.md),
    borderTopLeftRadius: theme.shape.radius.default,
    borderBottomLeftRadius: theme.shape.radius.default,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    width: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
    color: theme.colors.text.primary,
  }),
  labelText: css({
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    minWidth: 0,
    flex: 1,
  }),
});
