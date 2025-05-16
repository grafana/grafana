import { useMemo } from 'react';
import { useMeasure } from 'react-use';

import { Counter, LoadingBar, Pagination, Stack } from '@grafana/ui';
import { DEFAULT_PER_PAGE_PAGINATION } from 'app/core/constants';
import { CombinedRule, CombinedRuleNamespace } from 'app/types/unified-alerting';
import { PromAlertingRuleState } from 'app/types/unified-alerting-dto';

import { usePagination } from '../../hooks/usePagination';
import { useUnifiedAlertingSelector } from '../../hooks/useUnifiedAlertingSelector';
import { AlertRuleListItem } from '../../rule-list/components/AlertRuleListItem';
import { ListSection } from '../../rule-list/components/ListSection';
import { GRAFANA_RULES_SOURCE_NAME, getRulesDataSources } from '../../utils/datasource';
import { createViewLink } from '../../utils/misc';
import { isAsyncRequestStatePending } from '../../utils/redux';
import { hashRule } from '../../utils/rule-id';
import { getRulePluginOrigin, isProvisionedRule, prometheusRuleType } from '../../utils/rules';
import { calculateTotalInstances } from '../rule-viewer/RuleViewer';

import { RuleActionsButtons } from './RuleActionsButtons';

interface Props {
  namespaces: CombinedRuleNamespace[];
}

type GroupedRules = Map<PromAlertingRuleState, CombinedRule[]>;

export const RuleListStateView = ({ namespaces }: Props) => {
  const [ref, { width }] = useMeasure<HTMLUListElement>();

  const isLoading = useDataSourcesLoadingState();

  const groupedRules = useMemo(() => {
    const result: GroupedRules = new Map([
      [PromAlertingRuleState.Firing, []],
      [PromAlertingRuleState.Pending, []],
      [PromAlertingRuleState.Recovering, []],
      [PromAlertingRuleState.Inactive, []],
      [PromAlertingRuleState.Unknown, []],
    ]);

    namespaces.forEach((namespace) =>
      namespace.groups.forEach((group) =>
        group.rules.forEach((rule) => {
          // We might hit edge cases where there type = alerting, but there is no state.
          // In this case, we shouldn't try to group these alerts in the state view
          // Even though we handle this at the API layer, this is a last catch point for any edge cases
          if (prometheusRuleType.alertingRule(rule.promRule) && rule.promRule.state) {
            result.get(rule.promRule.state)?.push(rule);
          }
        })
      )
    );

    result.forEach((rules) => rules.sort((a, b) => a.name.localeCompare(b.name)));

    return result;
  }, [namespaces]);

  const entries = groupedRules.entries();

  return (
    <ul role="tree" ref={ref}>
      {isLoading && <LoadingBar width={width} />}
      <Stack direction="column">
        {Array.from(entries).map(([state, rules]) => (
          <RulesByState key={state} state={state} rules={rules} />
        ))}
      </Stack>
    </ul>
  );
};

const STATE_TITLES: Record<PromAlertingRuleState, string> = {
  [PromAlertingRuleState.Firing]: 'Firing',
  [PromAlertingRuleState.Pending]: 'Pending',
  [PromAlertingRuleState.Inactive]: 'Normal',
  [PromAlertingRuleState.Recovering]: 'Recovering',
  [PromAlertingRuleState.Unknown]: 'Unknown',
};

const RulesByState = ({ state, rules }: { state: PromAlertingRuleState; rules: CombinedRule[] }) => {
  const { page, pageItems, numberOfPages, onPageChange } = usePagination(rules, 1, DEFAULT_PER_PAGE_PAGINATION);

  const isFiringState = state !== PromAlertingRuleState.Firing;
  const hasRulesMatchingState = rules.length > 0;

  return (
    <ListSection
      title={
        <Stack alignItems="center" gap={0}>
          {STATE_TITLES[state] ?? 'Unknown'}
          <Counter value={rules.length} />
        </Stack>
      }
      collapsed={isFiringState || hasRulesMatchingState}
      pagination={
        <Pagination
          currentPage={page}
          numberOfPages={numberOfPages}
          onNavigate={onPageChange}
          hideWhenSinglePage={true}
        />
      }
    >
      {pageItems.map((rule) => {
        const { rulerRule, promRule } = rule;

        const isProvisioned = rulerRule ? isProvisionedRule(rulerRule) : false;
        const instancesCount = prometheusRuleType.alertingRule(rule.promRule)
          ? calculateTotalInstances(rule.instanceTotals)
          : undefined;

        if (!promRule) {
          return null;
        }

        const originMeta = getRulePluginOrigin(rule.promRule);

        return (
          <AlertRuleListItem
            key={hashRule(promRule)}
            name={rule.name}
            href={createViewLink(rule.namespace.rulesSource, rule)}
            summary={rule.annotations.summary}
            state={state}
            health={rule.promRule?.health}
            error={rule.promRule?.lastError}
            labels={rule.promRule?.labels}
            isProvisioned={isProvisioned}
            instancesCount={instancesCount}
            namespace={rule.namespace.name}
            group={rule.group.name}
            actions={<RuleActionsButtons compact rule={rule} rulesSource={rule.namespace.rulesSource} />}
            origin={originMeta}
          />
        );
      })}
    </ListSection>
  );
};

function useDataSourcesLoadingState() {
  const promRules = useUnifiedAlertingSelector((state) => state.promRules);
  const rulesDataSources = useMemo(getRulesDataSources, []);

  const grafanaLoading = useUnifiedAlertingSelector((state) => {
    const promLoading = isAsyncRequestStatePending(state.promRules[GRAFANA_RULES_SOURCE_NAME]);
    const rulerLoading = isAsyncRequestStatePending(state.rulerRules[GRAFANA_RULES_SOURCE_NAME]);

    return promLoading || rulerLoading;
  });

  const externalDataSourcesLoading = rulesDataSources.some((ds) => isAsyncRequestStatePending(promRules[ds.name]));

  const loading = grafanaLoading || externalDataSourcesLoading;

  return loading;
}
