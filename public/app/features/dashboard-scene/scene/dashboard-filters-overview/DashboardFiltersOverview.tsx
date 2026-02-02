import { css } from '@emotion/css';
import { useEffect, useMemo, useState } from 'react';

import { SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import {
  AdHocFilterWithLabels,
  AdHocFiltersVariable,
  GroupByVariable,
  OPERATORS,
  OperatorDefinition,
} from '@grafana/scenes';
import {
  Button,
  Checkbox,
  Collapse,
  Combobox,
  ComboboxOption,
  InlineLabel,
  MultiCombobox,
  Stack,
  useStyles2,
} from '@grafana/ui';

import { buildAdHocApplyFilters, buildGroupByUpdate, buildOverviewState } from './utils';

interface DashboardFiltersOverviewState {
  adhocFilters?: AdHocFiltersVariable;
  groupByVariable?: GroupByVariable;
  onClose: () => void;
}

export const DashboardFiltersOverview = ({ adhocFilters, groupByVariable, onClose }: DashboardFiltersOverviewState) => {
  const styles = useStyles2(getStyles);
  const [keys, setKeys] = useState<Array<SelectableValue<string>>>([]);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [operatorsByKey, setOperatorsByKey] = useState<Record<string, string>>({});
  const [singleValuesByKey, setSingleValuesByKey] = useState<Record<string, string>>({});
  const [multiValuesByKey, setMultiValuesByKey] = useState<Record<string, string[]>>({});
  const [valueOptionsByKey, setValueOptionsByKey] = useState<Record<string, Array<ComboboxOption<string>>>>({});
  const [isGrouped, setIsGrouped] = useState<Record<string, boolean>>({});
  const [isOriginByKey, setIsOriginByKey] = useState<Record<string, boolean>>({});

  const operatorOptions = useMemo<OperatorDefinition[]>(() => OPERATORS, []);
  const operatorComboboxOptions = useMemo(
    () =>
      operatorOptions.map((option: OperatorDefinition) => ({
        label: option.value,
        value: option.value,
      })),
    [operatorOptions]
  );

  const multiOperatorValues = useMemo(
    () => new Set(operatorOptions.filter((option: OperatorDefinition) => option.isMulti).map((option) => option.value)),
    [operatorOptions]
  );

  useEffect(() => {
    async function getKeys() {
      if (!adhocFilters) {
        return;
      }

      const {
        keys,
        operatorsByKey,
        multiValuesByKey,
        singleValuesByKey,
        isOriginByKey,
      } = buildOverviewState(adhocFilters.state, multiOperatorValues);
      keys.push(...(await adhocFilters._getKeys(null)));

      setKeys(keys);
      setOperatorsByKey(operatorsByKey);
      setMultiValuesByKey(multiValuesByKey);
      setSingleValuesByKey(singleValuesByKey);
      setIsOriginByKey(isOriginByKey);
    }

    getKeys();
  }, [adhocFilters, multiOperatorValues]);

  useEffect(() => {
    async function getGroupByKeys() {
      if (!groupByVariable) {
        return;
      }

      const groupByValues = Array.isArray(groupByVariable.state.value)
        ? groupByVariable.state.value
        : groupByVariable.state.value
          ? [groupByVariable.state.value]
          : [];

      const keyIsGrouped: Record<string, boolean> = {};
      for (const selectedKey of groupByValues) {
        keyIsGrouped[selectedKey.toString()] = true;
      }

      setIsGrouped(keyIsGrouped);
    }

    getGroupByKeys();
  }, [groupByVariable]);

  const { groupNames, groupedKeys, ungroupedKeys } = useMemo(() => {
    const groups = new Map<string, Array<SelectableValue<string>>>();
    const ungrouped: Array<SelectableValue<string>> = [];

    for (const key of keys) {
      const group = key.group;
      if (!group) {
        ungrouped.push(key);
        continue;
      }
      const groupKeys = groups.get(group);
      if (groupKeys) {
        groupKeys.push(key);
      } else {
        groups.set(group, [key]);
      }
    }

    return {
      groupNames: Array.from(groups.keys()),
      groupedKeys: groups,
      ungroupedKeys: ungrouped,
    };
  }, [keys]);

  useEffect(() => {
    if (groupNames.length === 0) {
      return;
    }
    setOpenGroups((prev) => {
      const next = { ...prev };
      for (const group of groupNames) {
        if (next[group] === undefined) {
          next[group] = true;
        }
      }
      return next;
    });
  }, [groupNames]);

  const getValueOptionsForKey = async (key: string, operator: string, inputValue: string) => {
    if (!adhocFilters) {
      return [];
    }

    let options = valueOptionsByKey[key];
    if (!options) {
      const filter: AdHocFilterWithLabels = {
        key,
        operator,
        value: '',
        condition: '',
      };
      const values = await adhocFilters._getValuesFor(filter);
      options = values.map((value) => ({
        label: value.label ?? value.value ?? '',
        value: value.value ?? value.label ?? '',
      }));
      setValueOptionsByKey((prev) => ({ ...prev, [key]: options }));
    }

    if (!inputValue) {
      return options;
    }

    const lowered = inputValue.toLowerCase();
    return options.filter((option) => (option.label ?? option.value).toLowerCase().includes(lowered));
  };

  const applyChanges = () => {
    if (groupByVariable) {
      const { nextValues, nextText } = buildGroupByUpdate(keys, isGrouped);
      groupByVariable.changeValueTo(nextValues, nextText, true);
    }

    if (adhocFilters) {
      const existingOriginFilters = adhocFilters.state.originFilters ?? [];
      const existingFilters = adhocFilters.state.filters ?? [];
      const { nextFilters, nextOriginFilters, nonApplicableOriginFilters, nonApplicableFilters } = buildAdHocApplyFilters({
        keys,
        isOriginByKey,
        operatorsByKey,
        singleValuesByKey,
        multiValuesByKey,
        existingOriginFilters,
        existingFilters,
        multiOperatorValues,
      });
      const validatedOriginFilters = adhocFilters.validateOriginFilters([
        ...nextOriginFilters,
        ...nonApplicableOriginFilters,
      ]);

      adhocFilters.setState({
        filters: [...nextFilters, ...nonApplicableFilters],
        originFilters: validatedOriginFilters,
      });
    }
  };

  const applyAndClose = () => {
    applyChanges();
    onClose();
  };

  if (!adhocFilters) {
    return <div>{t('dashboard.filters-overview.missing-adhoc', 'No ad hoc filters available')}</div>;
  }

  if (keys.length === 0) {
    return <div>{t('dashboard.filters-overview.empty', 'No labels available')}</div>;
  }

  const renderRow = (keyOption: SelectableValue<string>) => {
    const keyValue = keyOption.value ?? keyOption.label;
    if (!keyValue) {
      return null;
    }

    const operatorValue = operatorsByKey[keyValue] ?? '=';
    const isMultiOperator = multiOperatorValues.has(operatorValue);
    const singleValue = singleValuesByKey[keyValue] ?? '';
    const multiValues = multiValuesByKey[keyValue] ?? [];
    const isGroupBy = isGrouped[keyValue] ?? false;
    const isOrigin = isOriginByKey[keyValue] ?? false;

    return (
      <div key={keyValue} className={styles.row}>
        <div className={styles.labelCell}>
          <InlineLabel className={styles.label}>{keyOption.label ?? keyValue}</InlineLabel>
        </div>
        <div className={styles.operatorCell}>
          <Combobox
            aria-label={t('dashboard.filters-overview.operator', 'Operator')}
            options={operatorComboboxOptions}
            value={operatorValue}
            placeholder={t('dashboard.filters-overview.operator.placeholder', 'Select operator')}
            disabled={isOrigin}
            onChange={(option: ComboboxOption<string>) => {
              if (!option?.value) {
                return;
              }
              setOperatorsByKey((prev) => ({ ...prev, [keyValue]: option.value }));
            }}
          />
        </div>
        <div className={styles.valueCell}>
          {isMultiOperator ? (
            <MultiCombobox
              aria-label={t('dashboard.filters-overview.value', 'Value')}
              options={(inputValue: string) => getValueOptionsForKey(keyValue, operatorValue, inputValue)}
              value={multiValues}
              placeholder={t('dashboard.filters-overview.value.placeholder', 'Select values')}
              isClearable={true}
              onChange={(selections: Array<ComboboxOption<string>>) => {
                setMultiValuesByKey((prev) => ({
                  ...prev,
                  [keyValue]: selections.map((selection) => selection.value),
                }));
              }}
            />
          ) : (
            <Combobox
              aria-label={t('dashboard.filters-overview.value', 'Value')}
              options={(inputValue: string) => getValueOptionsForKey(keyValue, operatorValue, inputValue)}
              value={singleValue ? { label: singleValue, value: singleValue } : null}
              placeholder={t('dashboard.filters-overview.value.placeholder', 'Select value')}
              isClearable={true}
              onChange={(selection: ComboboxOption<string> | null) => {
                setSingleValuesByKey((prev) => ({ ...prev, [keyValue]: selection?.value ?? '' }));
              }}
            />
          )}
        </div>
        {groupByVariable ? (
          <div className={styles.groupByCell}>
            <Checkbox
              value={isGroupBy}
              label={t('dashboard.filters-overview.groupby', 'GroupBy')}
              onChange={() => {
                setIsGrouped((prev) => ({ ...prev, [keyValue]: !isGroupBy }));
              }}
            />
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className={styles.container}>
      <Stack direction="column" gap={1}>
        {ungroupedKeys.map(renderRow)}
        {groupNames.map((group) => {
          const groupKeys = groupedKeys.get(group) ?? [];
          return (
            <Collapse
              key={group}
              label={group}
              isOpen={openGroups[group] ?? true}
              onToggle={(isOpen) => setOpenGroups((prev) => ({ ...prev, [group]: isOpen }))}
            >
              <Stack direction="column" gap={1}>
                {groupKeys.map(renderRow)}
              </Stack>
            </Collapse>
          );
        })}
      </Stack>
      <div className={styles.footer}>
        <Stack direction="row" gap={1} justifyContent="flex-end">
          <Button variant="primary" onClick={applyChanges}>
            {t('dashboard.filters-overview.apply', 'Apply')}
          </Button>
          <Button variant="secondary" onClick={applyAndClose}>
            {t('dashboard.filters-overview.apply-close', 'Apply and close')}
          </Button>
          <Button variant="secondary" onClick={onClose}>
            {t('dashboard.filters-overview.close', 'Close')}
          </Button>
        </Stack>
      </div>
    </div>
  );
};

const getStyles = () => {
  return {
    container: css({
      width: '100%',
    }),
    row: css({
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    }),
    labelCell: css({
      flex: '0 1 25%',
      minWidth: 0,
      overflow: 'hidden',
    }),
    operatorCell: css({
      flex: '0 1 10%',
      minWidth: 0,
    }),
    valueCell: css({
      flex: '1 1 30%',
      minWidth: 0,
    }),
    groupByCell: css({
      flex: '0 1 15%',
      minWidth: 0,
    }),
    label: css({
      width: '100%',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    }),
    footer: css({
      marginTop: '16px',
      paddingTop: '12px',
      borderTop: '1px solid var(--border-weak)',
    }),
  };
};
