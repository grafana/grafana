import React, { FC, useEffect, useMemo } from 'react';
import { isEmpty, uniq } from 'lodash';
import { Icon, MultiSelect } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';
import { useDispatch } from 'react-redux';
import { fetchAllPromRulesAction } from 'app/features/alerting/unified/state/actions';
import { useUnifiedAlertingSelector } from 'app/features/alerting/unified/hooks/useUnifiedAlertingSelector';
import { getAllRulesSourceNames } from 'app/features/alerting/unified/utils/datasource';
import { PromRuleType } from 'app/types/unified-alerting-dto';
import { AlertingRule } from 'app/types/unified-alerting';
import { isPrivateLabel } from './util';
import {
  isAsyncRequestMapSliceFulfilled,
  isAsyncRequestMapSlicePending,
} from 'app/features/alerting/unified/utils/redux';

interface Props {
  id: string;
  defaultValue: SelectableValue<string>;
  onChange: (keys: string[]) => void;
}

export const GroupBy: FC<Props> = (props) => {
  const { onChange, id, defaultValue } = props;
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(fetchAllPromRulesAction());
  }, [dispatch]);

  const promRulesByDatasource = useUnifiedAlertingSelector((state) => state.promRules);
  const rulesDataSourceNames = useMemo(getAllRulesSourceNames, []);

  const allRequestsReady = isAsyncRequestMapSliceFulfilled(promRulesByDatasource);
  const loading = isAsyncRequestMapSlicePending(promRulesByDatasource);

  const labels = useMemo(() => {
    if (isEmpty(promRulesByDatasource)) {
      return [];
    }

    if (!allRequestsReady) {
      return [];
    }

    const allLabels = rulesDataSourceNames
      .flatMap((datasource) => promRulesByDatasource[datasource].result ?? [])
      .flatMap((rules) => rules.groups)
      .flatMap((group) => group.rules.filter((rule): rule is AlertingRule => rule.type === PromRuleType.Alerting))
      .flatMap((rule) => rule.alerts ?? [])
      .map((alert) => Object.keys(alert.labels ?? {}))
      .flatMap((labels) => labels.filter(isPrivateLabel));

    return uniq(allLabels);
  }, [allRequestsReady, promRulesByDatasource, rulesDataSourceNames]);

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
      menuShouldPortal={true}
    />
  );
};
