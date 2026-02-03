import { css } from '@emotion/css';
import { memo, useLayoutEffect, useRef } from 'react';
import { ListChildComponentProps } from 'react-window';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { GroupByVariable } from '@grafana/scenes';
import {
  Checkbox,
  Combobox,
  ComboboxOption,
  Icon,
  MultiCombobox,
  Tooltip,
  useStyles2,
} from '@grafana/ui';

import { FiltersOverviewActions, ListItem } from './useFiltersOverviewState';

// Row data passed through react-window
export interface RowData {
  items: ListItem[];
  groupByVariable?: GroupByVariable;
  openGroups: Record<string, boolean>;
  measureKey: number;
  operatorOptions: Array<ComboboxOption<string>>;
  operatorsByKey: Record<string, string>;
  multiOperatorValues: Set<string>;
  singleValuesByKey: Record<string, string>;
  multiValuesByKey: Record<string, string[]>;
  isGrouped: Record<string, boolean>;
  isOriginByKey: Record<string, boolean>;
  actions: FiltersOverviewActions & { setRowHeight: (index: number, size: number) => void };
}

// Group header component
interface GroupHeaderProps {
  group: string;
  isOpen: boolean;
  onToggle: (group: string, isOpen: boolean) => void;
}

const GroupHeader = memo(({ group, isOpen, onToggle }: GroupHeaderProps) => {
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

const FilterRow = memo(
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

// Main row component with resize observer for dynamic height
export const FiltersOverviewRow = memo(({ index, style, data }: ListChildComponentProps<RowData>) => {
  const item = data.items[index];
  if (!item) {
    return null;
  }

  if (item.type === 'group') {
    const isOpen = data.openGroups[item.group] ?? true;
    return (
      <div style={style}>
        <GroupHeader group={item.group} isOpen={isOpen} onToggle={data.actions.toggleGroup} />
      </div>
    );
  }

  return (
    <FilterRowWithResize
      index={index}
      style={style}
      item={item}
      data={data}
    />
  );
});

FiltersOverviewRow.displayName = 'FiltersOverviewRow';

// Wrapper for FilterRow that handles resize observation
interface FilterRowWithResizeProps {
  index: number;
  style: React.CSSProperties;
  item: Extract<ListItem, { type: 'row' }>;
  data: RowData;
}

const FilterRowWithResize = memo(({ index, style, item, data }: FilterRowWithResizeProps) => {
  const rowRef = useRef<HTMLDivElement | null>(null);
  const lastHeightRef = useRef<number | null>(null);
  const resizeRafRef = useRef<number | null>(null);

  const { keyOption, keyValue } = item;
  const operatorValue = data.operatorsByKey[keyValue] ?? '=';
  const isMultiOperator = data.multiOperatorValues.has(operatorValue);

  useLayoutEffect(() => {
    const node = rowRef.current;
    if (!node || typeof ResizeObserver === 'undefined') {
      return;
    }

    const applySize = () => {
      const nextHeight = node.getBoundingClientRect().height;
      if (lastHeightRef.current !== nextHeight) {
        lastHeightRef.current = nextHeight;
        data.actions.setRowHeight(index, nextHeight);
      }
    };

    const observer = new ResizeObserver(() => {
      if (resizeRafRef.current !== null) {
        return;
      }
      resizeRafRef.current = requestAnimationFrame(() => {
        resizeRafRef.current = null;
        applySize();
      });
    });

    observer.observe(node);
    applySize();

    return () => {
      observer.disconnect();
      if (resizeRafRef.current !== null) {
        cancelAnimationFrame(resizeRafRef.current);
        resizeRafRef.current = null;
      }
    };
  }, [data.actions, data.measureKey, index]);

  return (
    <div style={style}>
      <div ref={rowRef}>
        <FilterRow
          keyOption={keyOption}
          keyValue={keyValue}
          operatorValue={operatorValue}
          isMultiOperator={isMultiOperator}
          singleValue={data.singleValuesByKey[keyValue] ?? ''}
          multiValues={data.multiValuesByKey[keyValue] ?? []}
          isGroupBy={data.isGrouped[keyValue] ?? false}
          isOrigin={data.isOriginByKey[keyValue] ?? false}
          hasGroupByVariable={Boolean(data.groupByVariable)}
          operatorOptions={data.operatorOptions}
          onOperatorChange={data.actions.setOperator}
          onSingleValueChange={data.actions.setSingleValue}
          onMultiValuesChange={data.actions.setMultiValues}
          onGroupByToggle={data.actions.toggleGroupBy}
          getValueOptions={data.actions.getValueOptionsForKey}
        />
      </div>
    </div>
  );
});

FilterRowWithResize.displayName = 'FilterRowWithResize';

// Styles
const getGroupStyles = (theme: GrafanaTheme2) => ({
  groupRow: css({
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    padding: '0 4px',
    boxSizing: 'border-box',
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
    gap: '6px',
  }),
  groupLabel: css({
    fontWeight: 500,
  }),
});

const getRowStyles = (theme: GrafanaTheme2) => ({
  row: css({
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    width: '100%',
    overflow: 'hidden',
  }),
  labelCell: css({
    flex: '1 1 auto',
    minWidth: 0,
    overflow: 'hidden',
  }),
  operatorCell: css({
    flex: '0 0 auto',
    width: theme.spacing(8),
    overflow: 'hidden',
    '& > *': { width: '100%' },
  }),
  valueCell: css({
    flex: '0 0 auto',
    width: theme.spacing(26),
    overflow: 'hidden',
    '& > *': { width: '100%' },
  }),
  groupByCell: css({
    flex: '0 0 auto',
    width: theme.spacing(10),
    display: 'flex',
    alignItems: 'center',
    alignSelf: 'center',
    overflow: 'hidden',
  }),
  labelShell: css({
    display: 'flex',
    alignItems: 'center',
    padding: theme.spacing(0, 1),
    fontWeight: theme.typography.fontWeightMedium,
    fontSize: theme.typography.size.sm,
    backgroundColor: theme.colors.background.secondary,
    height: theme.spacing(theme.components.height.md),
    lineHeight: theme.spacing(theme.components.height.md),
    borderRadius: theme.shape.radius.default,
    width: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
    color: theme.colors.text.primary,
    overflow: 'hidden',
  }),
  labelText: css({
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    minWidth: 0,
    flex: 1,
  }),
});
