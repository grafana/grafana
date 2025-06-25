import { debounce, unionBy } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import * as React from 'react';

import { AppEvents, SelectableValue, toOption } from '@grafana/data';
import { getAppEvents } from '@grafana/runtime';
import { MultiSelect, InputActionMeta } from '@grafana/ui';

import { CloudWatchDatasource } from '../../../datasource';
import { appendTemplateVariables } from '../../../utils/utils';

const MAX_LOG_GROUPS = 20;
const MAX_VISIBLE_LOG_GROUPS = 4;
const DEBOUNCE_TIMER = 300;

export interface LogGroupSelectorProps {
  region: string;
  selectedLogGroups: string[];
  onChange: (logGroups: string[]) => void;

  datasource?: CloudWatchDatasource;
  onOpenMenu?: () => Promise<void>;
  width?: number | 'auto';
  saved?: boolean; // is only used in the config editor
}

export const LogGroupSelector: React.FC<LogGroupSelectorProps> = ({
  region,
  selectedLogGroups,
  onChange,
  datasource,
  onOpenMenu,
  width,
  saved = true,
}) => {
  const [loadingLogGroups, setLoadingLogGroups] = useState(false);
  const [availableLogGroups, setAvailableLogGroups] = useState<Array<SelectableValue<string>>>([]);
  const logGroupOptions = useMemo(
    () => unionBy(availableLogGroups, selectedLogGroups?.map(toOption), 'value'),
    [availableLogGroups, selectedLogGroups]
  );

  const fetchLogGroupOptions = useCallback(
    async (region: string, logGroupNamePrefix?: string) => {
      if (!datasource) {
        return [];
      }
      try {
        const logGroups = await datasource.resources.legacyDescribeLogGroups(region, logGroupNamePrefix);
        return logGroups;
      } catch (err) {
        getAppEvents().publish({
          type: AppEvents.alertError.name,
          payload: [typeof err === 'string' ? err : JSON.stringify(err)],
        });
        return [];
      }
    },
    [datasource]
  );

  const onLogGroupSearch = async (searchTerm: string, region: string, actionMeta: InputActionMeta) => {
    if (actionMeta.action !== 'input-change' || !datasource) {
      return;
    }

    // No need to fetch matching log groups if the search term isn't valid
    // This is also useful for preventing searches when a user is typing out a log group with template vars
    // See https://docs.aws.amazon.com/AmazonCloudWatchLogs/latest/APIReference/API_LogGroup.html for the source of the pattern below
    const logGroupNamePattern = /^[\.\-_/#A-Za-z0-9]+$/;
    if (!logGroupNamePattern.test(searchTerm)) {
      if (searchTerm !== '') {
        getAppEvents().publish({
          type: AppEvents.alertError.name,
          payload: ['Invalid Log Group name: ' + searchTerm],
        });
      }
      return;
    }

    setLoadingLogGroups(true);
    const matchingLogGroups = await fetchLogGroupOptions(region, searchTerm);
    setAvailableLogGroups(unionBy(availableLogGroups, matchingLogGroups, 'value'));
    setLoadingLogGroups(false);
  };

  // Reset the log group options if the datasource or region change and are saved
  useEffect(() => {
    async function getAvailableLogGroupOptions() {
      // Don't call describeLogGroups if datasource or region is undefined
      if (!datasource || !datasource.getActualRegion(region)) {
        setAvailableLogGroups([]);
        return;
      }

      setLoadingLogGroups(true);
      return fetchLogGroupOptions(datasource.getActualRegion(region))
        .then((logGroups) => {
          setAvailableLogGroups(logGroups);
        })
        .finally(() => {
          setLoadingLogGroups(false);
        });
    }

    // Config editor does not fetch new log group options unless changes have been saved
    saved && getAvailableLogGroupOptions();

    // if component unmounts in the middle of setting state, we reset state and unsubscribe from fetchLogGroupOptions
    return () => {
      setAvailableLogGroups([]);
      setLoadingLogGroups(false);
    };
    // this hook shouldn't get called every time selectedLogGroups or onChange updates
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasource, region, saved]);

  const onOpenLogGroupMenu = async () => {
    if (onOpenMenu) {
      await onOpenMenu();
    }
  };

  const onLogGroupSearchDebounced = debounce(onLogGroupSearch, DEBOUNCE_TIMER);

  return (
    <MultiSelect
      inputId="default-log-groups"
      aria-label="Log Groups"
      allowCustomValue
      options={datasource ? appendTemplateVariables(datasource, logGroupOptions) : logGroupOptions}
      value={selectedLogGroups}
      onChange={(v) => onChange(v.filter(({ value }) => value).map(({ value }) => value))}
      closeMenuOnSelect={false}
      isClearable
      isOptionDisabled={() => selectedLogGroups.length >= MAX_LOG_GROUPS}
      placeholder="Choose Log Groups"
      maxVisibleValues={MAX_VISIBLE_LOG_GROUPS}
      noOptionsMessage="No log groups available"
      isLoading={loadingLogGroups}
      onOpenMenu={onOpenLogGroupMenu}
      onInputChange={(value, actionMeta) => {
        onLogGroupSearchDebounced(value, region, actionMeta);
      }}
      width={width}
    />
  );
};
