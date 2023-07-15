import { isEmpty, uniq } from 'lodash';
import React, { useEffect, useMemo } from 'react';

import { SelectableValue } from '@grafana/data';
import { Icon, MultiSelect } from '@grafana/ui';
import { useUnifiedAlertingSelector } from 'app/features/alerting/unified/hooks/useUnifiedAlertingSelector';
import { fetchAllPromRulesAction } from 'app/features/alerting/unified/state/actions';
import {
  isAsyncRequestMapSlicePending,
  isAsyncRequestMapSliceSettled,
} from 'app/features/alerting/unified/utils/redux';
import { useDispatch } from 'app/types';
import { AlertingRule } from 'app/types/unified-alerting';
import { PromRuleType } from 'app/types/unified-alerting-dto';

import { fetchPromRulesAction } from '../../../features/alerting/unified/state/actions';

import { isPrivateLabel } from './util';

interface Props {
  id: string;
  defaultValue: SelectableValue<string>;
  onChange: (keys: string[]) => void;
  dataSource?: string;
}

export const GroupBy = (props: Props) => {
  const { onChange, id, defaultValue, dataSource } = props;
  const dispatch = useDispatch();

  useEffect(() => {
    if (dataSource) {
      dataSource && dispatch(fetchPromRulesAction({ rulesSourceName: dataSource }));
    } else {
      dispatch(fetchAllPromRulesAction());
    }
  }, [dispatch, dataSource]);

  const promRulesByDatasource = useUnifiedAlertingSelector((state) => state.promRules);

  const allRequestsReady = isAsyncRequestMapSliceSettled(promRulesByDatasource);
  const loading = isAsyncRequestMapSlicePending(promRulesByDatasource);

  const labels = useMemo(() => {
    if (isEmpty(promRulesByDatasource)) {
      return [];
    }

    if (!allRequestsReady) {
      return [];
    }

    const allLabels = Object.keys(promRulesByDatasource)
      .flatMap((datasource) => promRulesByDatasource[datasource].result ?? [])
      .flatMap((rules) => rules.groups)
      .flatMap((group) => group.rules.filter((rule): rule is AlertingRule => rule.type === PromRuleType.Alerting))
      .flatMap((rule) => rule.alerts ?? [])
      .map((alert) => Object.keys(alert.labels ?? {}))
      .flatMap((labels) => labels.filter(isPrivateLabel));

    return uniq(allLabels);
  }, [allRequestsReady, promRulesByDatasource]);

  return (
    <MultiSelect<string>
      id={id}
      isLoading={loading}
      defaultValue={defaultValue}
      aria-label={'group by label keys'}
      placeholder="Group by"
      prefix={<Icon name={'tag-alt'} />}
      onChange={(items) => {
        onChange(items.map((item) => item.value ?? ''));
      }}
      options={labels.map<SelectableValue>((key) => ({
        label: key,
        value: key,
      }))}
    />
  );
};
