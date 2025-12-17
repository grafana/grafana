import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { lastValueFrom } from 'rxjs';

import { fuzzySearch } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans } from '@grafana/i18n';
import { GroupByVariable, SceneDataQuery, VariableValueOption, VariableValueSingle } from '@grafana/scenes';
import { Button, Icon, Popover } from '@grafana/ui';

import { PanelGroupByActionPopover } from './PanelGroupByActionPopover';

interface Props {
  groupByVariable: GroupByVariable;
  queries: SceneDataQuery[];
}

export function PanelGroupByAction({ groupByVariable, queries }: Props) {
  const { options: groupByOptions } = groupByVariable.useState();

  const [options, setOptions] = useState<VariableValueOption[]>([]);
  const [selectedValues, setSelectedValues] = useState<VariableValueSingle[]>([]);
  const [searchValue, setSearchValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [reloadOptions, setReloadOptions] = useState(false);
  const [isPopoverVisible, setPopoverVisible] = useState<boolean>(false);

  const ref = useRef<HTMLButtonElement>(null);

  const fetchOptions = useCallback(async () => {
    if (!groupByVariable || !reloadOptions) {
      return;
    }

    setIsLoading(true);
    try {
      if (groupByOptions.length === 0) {
        await lastValueFrom(groupByVariable.validateAndUpdate());
        const options = await getApplicableGroupByOptions(groupByVariable, groupByVariable.state.options, queries);

        setSelectedValues(getGroupByValue(groupByVariable));
        setOptions(options);
        return;
      }

      const options = await getApplicableGroupByOptions(groupByVariable, groupByOptions, queries);

      setSelectedValues(getGroupByValue(groupByVariable));
      setOptions(options);
    } catch (error) {
      setSelectedValues([]);
      setOptions([]);
    } finally {
      setIsLoading(false);
      setReloadOptions(false);
    }
  }, [groupByOptions, groupByVariable, queries, reloadOptions]);

  useEffect(() => {
    setReloadOptions(true);
  }, [groupByOptions, queries]);

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
    // Reset checked state to match current variable value when opening
    setSelectedValues(getGroupByValue(groupByVariable));
    setPopoverVisible(true);
  };

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
    >
      <Trans i18nKey="panel-group-by.button">Group by</Trans>
      <Icon name="angle-down" />
      {isPopoverVisible && ref.current && (
        <Popover
          content={
            <PanelGroupByActionPopover
              groupByVariable={groupByVariable}
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

function getGroupByValue(groupByVariable: GroupByVariable) {
  return Array.isArray(groupByVariable.state.value)
    ? groupByVariable.state.value
    : groupByVariable.state.value
      ? [groupByVariable.state.value]
      : [];
}

async function getApplicableGroupByOptions(
  groupByVariable: GroupByVariable,
  options: VariableValueOption[],
  queries: SceneDataQuery[]
) {
  const values = options.map((option) => option.value);
  const applicability = await groupByVariable.getGroupByApplicabilityForQueries(values, queries);

  return applicability
    ? applicability.filter((item) => item.applicable).map((item) => ({ label: item.key, value: item.key }))
    : options;
}
