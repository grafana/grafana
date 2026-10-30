import { useState, useCallback, useEffect, useMemo, useRef } from 'react';

import { fuzzySearch, type MetricFindValue } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans } from '@grafana/i18n';
import { getDataSourceInstance } from '@grafana/runtime';
import {
  type AdHocFiltersVariable,
  GroupByVariable,
  type SceneDataQuery,
  type VariableValueOption,
  type VariableValueSingle,
} from '@grafana/scenes';
import { Button, Icon, Popover } from '@grafana/ui';
import { type TooltipPlacement } from '@grafana/ui/internal';

import { usePanelActionsOverlayOpenChange } from '../../edit-actions-popover/PanelActionsOverlayContext';

import { PanelGroupByActionPopover } from './PanelGroupByActionPopover';

interface Props {
  groupByVariable?: GroupByVariable;
  adhocGroupByVariable?: AdHocFiltersVariable;
  queries: SceneDataQuery[];
}

export function PanelGroupByAction({ groupByVariable, adhocGroupByVariable, queries }: Props) {
  const [isPopoverVisible, setPopoverVisible] = useState<boolean>(false);
  const onPopoverOpenChange = usePanelActionsOverlayOpenChange();

  useEffect(() => {
    onPopoverOpenChange(isPopoverVisible);
  }, [isPopoverVisible, onPopoverOpenChange]);

  const ref = useRef<HTMLButtonElement>(null);

  if (!groupByVariable && !adhocGroupByVariable) {
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
        setPopoverVisible(true);
        ev.stopPropagation();
      }}
      onPointerDown={(ev) => ev.stopPropagation()}
      onPointerUp={(ev) => ev.stopPropagation()}
    >
      <Trans i18nKey="panel-group-by.button">Group by</Trans>
      <Icon name="angle-down" />
      {isPopoverVisible && ref.current && (
        <PanelGroupByPicker
          groupByVariable={groupByVariable}
          adhocGroupByVariable={adhocGroupByVariable}
          queries={queries}
          referenceElement={ref.current}
          onClose={() => setPopoverVisible(false)}
        />
      )}
    </Button>
  );
}

interface PanelGroupByPickerProps extends Props {
  referenceElement: HTMLElement;
  onClose: () => void;
  placement?: TooltipPlacement;
}

/**
 * The panel group by picker: lists the group by keys that apply to the panel's queries and applies the selection to
 * the dashboard's group by variable.
 */
export function PanelGroupByPicker({
  groupByVariable,
  adhocGroupByVariable,
  queries,
  referenceElement,
  onClose,
  placement = 'bottom-start',
}: PanelGroupByPickerProps) {
  const activeVariable = groupByVariable ?? adhocGroupByVariable;
  const [options, setOptions] = useState<VariableValueOption[]>([]);
  const [selectedValues, setSelectedValues] = useState<VariableValueSingle[]>(() =>
    activeVariable ? getGroupByValue(activeVariable) : []
  );
  const [searchValue, setSearchValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const fetchOptions = useCallback(async () => {
    if (!activeVariable) {
      return;
    }

    setIsLoading(true);
    try {
      let fetchedOptions: VariableValueOption[];

      if (groupByVariable) {
        const ds = await getDataSourceInstance(groupByVariable.state.datasource);
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
    fetchOptions();
  }, [fetchOptions]);

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
    onClose();
  };

  if (!activeVariable) {
    return null;
  }

  return (
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
        if (event.key === 'Escape') {
          // Closes only the picker, so a popover it was opened from stays open with focus back on its trigger.
          event.stopPropagation();
          onCancel();
          getFocusTarget(referenceElement)?.focus();
        }
      }}
      placement={placement}
      referenceElement={referenceElement}
      show
    />
  );
}

/** The reference element itself when it takes focus, otherwise the first control inside it. */
function getFocusTarget(element: HTMLElement): HTMLElement | null {
  const focusable = 'button, a[href], [tabindex]';
  return element.matches(focusable) ? element : element.querySelector<HTMLElement>(focusable);
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
