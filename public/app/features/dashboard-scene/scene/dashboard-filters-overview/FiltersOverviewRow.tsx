import { css } from '@emotion/css';
import { memo } from 'react';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Checkbox, Combobox, ComboboxOption, Icon, MultiCombobox, Tooltip, useStyles2 } from '@grafana/ui';

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

const getRowStyles = (theme: GrafanaTheme2) => {
  // Shared z-index layering so focused/hovered cell borders render on top of overlapping neighbors
  const cellLayering = {
    position: 'relative' as const,
    zIndex: 0,
    '&:hover': { zIndex: 1 },
    '&:focus-within': { zIndex: 3 },
  };

  return {
    row: css({
      display: 'flex',
      alignItems: 'flex-start',
      width: '100%',
    }),
    labelCell: css({
      ...cellLayering,
      flex: '1 1 auto',
      minWidth: 0,
    }),
    operatorCell: css({
      ...cellLayering,
      flex: '0 0 auto',
      width: theme.spacing(8),
      marginLeft: -1,
      // && doubles specificity (0-2-0) to override Combobox defaults (0-1-0)
      '&& > *': {
        width: '100%',
        paddingLeft: 0,
        paddingRight: 0,
        borderRadius: 'unset',
      },
      '&& > * > *': {
        borderRadius: 'unset',
      },
      '&& input': {
        borderRadius: 'unset',
      },
    }),
    valueCell: css({
      ...cellLayering,
      flex: '0 0 auto',
      width: theme.spacing(26),
      marginLeft: -1,
      '&& > *': {
        width: '100%',
        paddingLeft: 0,
        borderTopLeftRadius: 'unset',
        borderBottomLeftRadius: 'unset',
      },
      '&& > * > *': {
        borderTopLeftRadius: 'unset',
        borderBottomLeftRadius: 'unset',
      },
      '&& input': {
        borderTopLeftRadius: 'unset',
        borderBottomLeftRadius: 'unset',
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
      fontWeight: theme.typography.fontWeightMedium,
      fontSize: theme.typography.size.sm,
      backgroundColor: theme.colors.background.secondary,
      border: `1px solid ${theme.components.input.borderColor}`,
      height: theme.spacing(theme.components.height.md),
      lineHeight: theme.spacing(theme.components.height.md),
      borderRadius: `${theme.shape.radius.default} 0 0 ${theme.shape.radius.default}`,
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
  };
};
