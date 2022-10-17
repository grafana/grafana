import { debounce, isEqual, unionWith } from 'lodash';
import React, { useCallback, useState } from 'react';

import { SelectableValue } from '@grafana/data';
import { MultiSelect } from '@grafana/ui';
import { InputActionMeta } from '@grafana/ui/src/components/Select/types';
import { notifyApp } from 'app/core/actions';
import { createErrorNotification } from 'app/core/copy/appNotification';
import { dispatch } from 'app/store/store';

import { SelectableResourceValue } from '../api';

const MAX_LOG_GROUPS = 20;
const MAX_VISIBLE_LOG_GROUPS = 4;
const DEBOUNCE_TIMER = 300;

export interface LogGroupSelectorProps {
  selectedLogGroups: string[];
  onChange: (logGroupsToSave: string[]) => void;
  describeLogGroups: (logGroupNamePrefix?: string) => Promise<SelectableResourceValue[]> | undefined;
  onBlur?: () => void;
  width?: number | 'auto';
}

export const LogGroupSelector: React.FC<LogGroupSelectorProps> = ({
  selectedLogGroups,
  onChange,
  onBlur,
  describeLogGroups,
  width,
}) => {
  const [loadingLogGroups, setLoadingLogGroups] = useState(false);
  const [fetchedLogGroupOptions, setFetchedLogGroupOptions] = useState<Array<SelectableValue<string>>>([]);

  const fetchLogGroupOptions = useCallback(
    async (logGroupNamePrefix?: string) => {
      try {
        setLoadingLogGroups(true);
        const logGroups = await describeLogGroups(logGroupNamePrefix);
        if (logGroups) {
          setFetchedLogGroupOptions(logGroups);
        }
      } catch (err) {
        setFetchedLogGroupOptions([]);
        dispatch(
          notifyApp(
            createErrorNotification(
              'Error Finding Log Groups:',
              typeof err === 'string'
                ? err
                : 'Unexpected error while fetching log groups, please check connection details and aws permissions'
            )
          )
        );
      }
      setLoadingLogGroups(false);
    },
    [describeLogGroups]
  );

  const onLogGroupSearch = async (searchTerm: string, actionMeta: InputActionMeta) => {
    if (actionMeta.action !== 'input-change') {
      return;
    }

    // No need to fetch matching log groups if the search term isn't valid
    // This is also useful for preventing searches when a user is typing out a log group with template vars
    // See https://docs.aws.amazon.com/AmazonCloudWatchLogs/latest/APIReference/API_LogGroup.html for the source of the pattern below
    const logGroupNamePattern = /^[\.\-_/#A-Za-z0-9]+$/;
    if (!logGroupNamePattern.test(searchTerm)) {
      if (searchTerm !== '') {
        dispatch(notifyApp(createErrorNotification('Invalid Log Group name: ' + searchTerm)));
      }
      return;
    }

    fetchLogGroupOptions(searchTerm);
  };

  const onLogGroupSearchDebounced = debounce(onLogGroupSearch, DEBOUNCE_TIMER);

  // always show selected log groups even if they are no longer valid,
  // it's too confusing to see them disappear,
  // and fairly clear to show an error that they are not valid when queried
  const logGroupOptions = unionWith(
    fetchedLogGroupOptions,
    selectedLogGroups.map((s) => ({ text: s, value: s, label: s })),
    isEqual
  );

  return (
    <MultiSelect
      inputId="default-log-groups"
      aria-label="Log Groups"
      allowCustomValue
      options={logGroupOptions}
      value={selectedLogGroups}
      onChange={(logGroups: Array<SelectableValue<string>>) => onChange(logGroups.map((lg) => lg.text))}
      onBlur={onBlur}
      closeMenuOnSelect={false}
      isClearable
      isOptionDisabled={() => selectedLogGroups.length >= MAX_LOG_GROUPS}
      placeholder="Choose Log Groups"
      maxVisibleValues={MAX_VISIBLE_LOG_GROUPS}
      noOptionsMessage="No log groups available"
      isLoading={loadingLogGroups}
      onOpenMenu={fetchLogGroupOptions}
      onInputChange={(value, actionMeta) => {
        onLogGroupSearchDebounced(value, actionMeta);
      }}
      width={width}
    />
  );
};
