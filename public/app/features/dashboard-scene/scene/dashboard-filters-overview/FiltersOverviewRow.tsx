import { css, cx } from '@emotion/css';
import { memo, useMemo, useState } from 'react';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Checkbox, ComboboxOption, getInputStyles, Icon, MultiSelect, Select, Tooltip, useStyles2 } from '@grafana/ui';

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

const OPERATOR_MENU_MIN_WIDTH = 200;

const WideMenu = ({
  children,
  innerRef,
  innerProps,
}: {
  children: React.ReactNode;
  innerRef: React.Ref<HTMLDivElement>;
  innerProps: React.HTMLAttributes<HTMLDivElement> & { style?: React.CSSProperties };
}) => (
  <div ref={innerRef} {...innerProps} style={{ ...innerProps.style, minWidth: OPERATOR_MENU_MIN_WIDTH }}>
    {children}
  </div>
);

interface FilterRowProps {
  keyOption: SelectableValue<string>;
  keyValue: string;
  operatorValue: string;
  isMultiOperator: boolean;
  singleValue: string;
  multiValues: string[];
  isGroupBy: boolean;
  isOrigin: boolean;
  isRestorable: boolean;
  hasGroupByVariable: boolean;
  operatorOptions: Array<SelectableValue<string>>;
  onOperatorChange: (key: string, operator: string) => void;
  onSingleValueChange: (key: string, value: string) => void;
  onMultiValuesChange: (key: string, values: string[]) => void;
  onGroupByToggle: (key: string, nextValue: boolean) => void;
  onRestore: (key: string) => void;
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
    isRestorable,
    hasGroupByVariable,
    operatorOptions,
    onOperatorChange,
    onSingleValueChange,
    onMultiValuesChange,
    onGroupByToggle,
    onRestore,
    getValueOptions,
  }: FilterRowProps) => {
    const styles = useStyles2(getRowStyles);
    const label = keyOption.label ?? keyValue;

    const [valueOptions, setValueOptions] = useState<Array<SelectableValue<string>>>([]);
    const [isLoadingValues, setIsLoadingValues] = useState(false);
    const [isValuesMenuOpen, setIsValuesMenuOpen] = useState(false);

    const handleOpenValuesMenu = async () => {
      setIsLoadingValues(true);
      const options = await getValueOptions(keyValue, operatorValue, '');
      setValueOptions(options.map((o) => ({ label: o.label, value: o.value })));
      setIsLoadingValues(false);
      setIsValuesMenuOpen(true);
    };

    const handleCloseValuesMenu = () => {
      setIsValuesMenuOpen(false);
    };

    const restoreIndicator = useMemo(() => {
      if (!isRestorable) {
        return undefined;
      }
      return {
        IndicatorsContainer: (props: React.PropsWithChildren) => (
          <div className={styles.indicators}>
            <Tooltip content={t('dashboard.filters-overview.restore', 'Restore default value')}>
              <span
                role="button"
                tabIndex={0}
                className={styles.restoreButton}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onRestore(keyValue);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.stopPropagation();
                    onRestore(keyValue);
                  }
                }}
              >
                <Icon name="history" />
              </span>
            </Tooltip>
            {props.children}
          </div>
        ),
      };
    }, [isRestorable, keyValue, onRestore, styles.indicators, styles.restoreButton]);

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
          <Select<string>
            aria-label={t('dashboard.filters-overview.operator', 'Operator')}
            options={operatorOptions}
            value={operatorValue}
            placeholder={t('dashboard.filters-overview.operator.placeholder', 'Select operator')}
            disabled={isOrigin}
            components={{ Menu: WideMenu }}
            onChange={(option) => {
              if (option?.value) {
                onOperatorChange(keyValue, option.value);
              }
            }}
          />
        </div>

        {/* Value cell */}
        <div className={styles.valueCell}>
          {isMultiOperator ? (
            <MultiSelect<string>
              aria-label={t('dashboard.filters-overview.value', 'Value')}
              options={valueOptions}
              value={multiValues.map((v) => ({ label: v, value: v }))}
              placeholder={t('dashboard.filters-overview.value.placeholder', 'Select values')}
              allowCustomValue
              isClearable
              isLoading={isLoadingValues}
              isOpen={isValuesMenuOpen}
              closeMenuOnSelect={false}
              components={restoreIndicator}
              onOpenMenu={handleOpenValuesMenu}
              onCloseMenu={handleCloseValuesMenu}
              onChange={(selections) => {
                onMultiValuesChange(
                  keyValue,
                  selections.map((s) => s.value ?? '')
                );
              }}
            />
          ) : (
            <Select<string>
              aria-label={t('dashboard.filters-overview.value', 'Value')}
              options={valueOptions}
              value={singleValue ? { label: singleValue, value: singleValue } : null}
              placeholder={t('dashboard.filters-overview.value.placeholder', 'Select value')}
              allowCustomValue
              isClearable
              isLoading={isLoadingValues}
              isOpen={isValuesMenuOpen}
              components={restoreIndicator}
              onOpenMenu={handleOpenValuesMenu}
              onCloseMenu={handleCloseValuesMenu}
              onChange={(selection) => {
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
      flex: '0 0 25%',
      maxWidth: '25%',
      minWidth: '25%',
    }),
    operatorCell: css({
      ...cellLayering,
      flex: '0 0 auto',
      width: theme.spacing(8),
      marginLeft: -1,
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
      flex: '1 1 0',
      minWidth: 0,
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
    indicators: cx(getInputStyles({ theme, invalid: false }).suffix, css({ position: 'relative' })),
    restoreButton: css({
      display: 'flex',
      alignItems: 'center',
      cursor: 'pointer',
      color: theme.colors.text.secondary,
      '&:hover': {
        color: theme.colors.text.primary,
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
