import { useState, useCallback, useEffect, useMemo, useRef } from 'react';

import type { MetricFindValue } from '@grafana/data/types';
import { fuzzySearch } from '@grafana/data/utils';
import { selectors } from '@grafana/e2e-selectors';
import { Trans } from '@grafana/i18n';
import { getDataSourceSrv } from '@grafana/runtime';
import {
  type AdHocFiltersVariable,
  GroupByVariable,
  type SceneDataQuery,
  type VariableValueOption,
  type VariableValueSingle,
} from '@grafana/scenes';
import { Button, Popover } from '@grafana/ui';
import { Icon } from '@grafana/ui/components/icons';

import { PanelGroupByActionPopover } from './PanelGroupByActionPopover';

interface Props {
  groupByVariable?: GroupByVariable;
  adhocGroupByVariable?: AdHocFiltersVariable;
  queries: SceneDataQuery[];
}

export function PanelGroupByAction({ groupByVariable, adhocGroupByVariable, queries }: Props) {
  const [options, setOptions] = useState<VariableValueOption[]>([]);
  const [selectedValues, setSelectedValues] = useState<VariableValueSingle[]>([]);
  const [searchValue, setSearchValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isPopoverVisible, setPopoverVisible] = useState<boolean>(false);

  const ref = useRef<HTMLButtonElement>(null);

  const activeVariable = groupByVariable ?? adhocGroupByVariable;

  const fetchOptions = useCallback(async () => {
    if (!activeVariable) {
      return;
    }

    setIsLoading(true);
    try {
      let fetchedOptions: VariableValueOption[];

      if (groupByVariable) {
        const ds = await getDataSourceSrv().get(groupByVariable.state.datasource);
        const keys = await groupByVariable._getKeys(ds, queries);
        fetchedOptions = metricFindValuesToOptions(Array.isArray(keys) ? keys : (keys.data ?? []));
      } else if (adhocGroupByVariable) {
        const selectableValues = await adhocGroupByVariable._getGroupByKeys(null, queries);
        fetchedOptions = selectableValues.map((sv) => ({
          label: sv.label ?? String(sv.value ?? ''),
          value: sv.value ?? '',
        }));
      } else {
        fetchedOptions = [];
      }

      setSelectedValues(getGroupByValue(activeVariable));
      setOptions(fetchedOptions);
    } catch (error) {
      setSelectedValues([]);
      setOptions([]);
    } finally {
      setIsLoading(false);
    }
  }, [activeVariable, groupByVariable, adhocGroupByVariable, queries]);

  useEffect(() => {
    if (isPopoverVisible) {
      fetchOptions();
    }
  }, [fetchOptions, isPopoverVisible]);

  const filteredOptions = useMemo(() => {
    if (!searchValue) {
      return options;
    }

    const haystack = options.map((option) => option.label);
    const indices = fuzzySearch(haystack, searchValue);
    return indices.map((idx) => options[idx]);
  }, [options, searchValue]);

  const onCancel = () => {
    setSearchValue('');
    setPopoverVisible(false);
  };

  const openPopover = () => {
    if (activeVariable) {
      setSelectedValues(getGroupByValue(activeVariable));
    }
    setPopoverVisible(true);
  };

  if (!activeVariable) {
    return null;
  }

  return (
    <Button
      variant="secondary"
      size="sm"
      fill="text"
      data-testid={selectors.components.Panels.Panel.PanelGroupByHeaderAction}
      ref={ref}
      onClick={(ev) => {
        openPopover();
        ev.stopPropagation();
      }}
      onPointerDown={(ev) => ev.stopPropagation()}
      onPointerUp={(ev) => ev.stopPropagation()}
    >
      <Trans i18nKey="panel-group-by.button">Group by</Trans>
      <Icon name="angle-down" />
      {isPopoverVisible && ref.current && (
        <Popover
          content={
            <PanelGroupByActionPopover
              groupByVariable={activeVariable}
              onCancel={onCancel}
              isLoading={isLoading}
              searchValue={searchValue}
              setSearchValue={setSearchValue}
              options={filteredOptions}
              values={selectedValues}
              onValuesChange={setSelectedValues}
            />
          }
          onKeyDown={(event) => {
            if (event.key === ' ') {
              event.stopPropagation();
            }
          }}
          placement="bottom-start"
          referenceElement={ref.current}
          show
        />
      )}
    </Button>
  );
}

function metricFindValuesToOptions(values: MetricFindValue[]): VariableValueOption[] {
  return values.map((v) => ({
    label: v.text,
    value: v.value ? String(v.value) : v.text,
    group: v.group,
  }));
}

function getGroupByValue(variable: GroupByVariable | AdHocFiltersVariable): VariableValueSingle[] {
  if (variable instanceof GroupByVariable) {
    return Array.isArray(variable.state.value)
      ? variable.state.value
      : variable.state.value
        ? [variable.state.value]
        : [];
  }

  const userGroupBys = variable.state.filters.filter((f) => f.operator === 'groupBy').map((f) => f.key);
  const originGroupBys = (variable.state.originFilters ?? [])
    .filter((f) => f.operator === 'groupBy' && !f.dismissedGroupBy)
    .map((f) => f.key);

  return [...originGroupBys, ...userGroupBys];
}
