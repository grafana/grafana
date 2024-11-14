import { css } from '@emotion/css';
import { useMemo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Counter, Pagination, Stack, useStyles2 } from '@grafana/ui';
import { DEFAULT_PER_PAGE_PAGINATION } from 'app/core/constants';
import { CombinedRule, CombinedRuleNamespace } from 'app/types/unified-alerting';
import { PromAlertingRuleState } from 'app/types/unified-alerting-dto';

import { usePagination } from '../../hooks/usePagination';
import { AlertRuleListItem } from '../../rule-list/components/AlertRuleListItem';
import { ListSection } from '../../rule-list/components/ListSection';
import { createViewLink } from '../../utils/misc';
import { hashRule } from '../../utils/rule-id';
import { getRulePluginOrigin, isAlertingRule, isProvisionedRule } from '../../utils/rules';
import { calculateTotalInstances } from '../rule-viewer/RuleViewer';

import { RuleActionsButtons } from './RuleActionsButtons';

interface Props {
  namespaces: CombinedRuleNamespace[];
}

type GroupedRules = Map<PromAlertingRuleState, CombinedRule[]>;

export const RuleListStateView = ({ namespaces }: Props) => {
  const styles = useStyles2(getStyles);

  const groupedRules = useMemo(() => {
    const result: GroupedRules = new Map([
      [PromAlertingRuleState.Firing, []],
      [PromAlertingRuleState.Pending, []],
      [PromAlertingRuleState.Inactive, []],
    ]);

    namespaces.forEach((namespace) =>
      namespace.groups.forEach((group) =>
        group.rules.forEach((rule) => {
          // We might hit edge cases where there type = alerting, but there is no state.
          // In this case, we shouldn't try to group these alerts in the state view
          // Even though we handle this at the API layer, this is a last catch point for any edge cases
          if (rule.promRule && isAlertingRule(rule.promRule) && rule.promRule.state) {
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
    <ul className={styles.columnStack} role="tree">
      {Array.from(entries).map(([state, rules]) => (
        <RulesByState key={state} state={state} rules={rules} />
      ))}
    </ul>
  );
};

const STATE_TITLES: Record<PromAlertingRuleState, string> = {
  [PromAlertingRuleState.Firing]: 'Firing',
  [PromAlertingRuleState.Pending]: 'Pending',
  [PromAlertingRuleState.Inactive]: 'Normal',
};

const RulesByState = ({ state, rules }: { state: PromAlertingRuleState; rules: CombinedRule[] }) => {
  const { page, pageItems, numberOfPages, onPageChange } = usePagination(rules, 1, DEFAULT_PER_PAGE_PAGINATION);

  const isNotFiringState = state !== PromAlertingRuleState.Firing;
  const hasRulesMatchingState = rules.length > 0;

  return (
    <ListSection
      title={
        <Stack alignItems="center" gap={0}>
          {STATE_TITLES[state] ?? 'Unknown'}
          <Counter value={rules.length} />
        </Stack>
      }
      collapsed={isNotFiringState || hasRulesMatchingState}
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
        const instancesCount = isAlertingRule(rule.promRule) ? calculateTotalInstances(rule.instanceTotals) : undefined;

        if (!promRule) {
          return null;
        }

        const originMeta = getRulePluginOrigin(rule);

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
            namespace={rule.namespace}
            group={rule.group.name}
            actions={<RuleActionsButtons compact rule={rule} rulesSource={rule.namespace.rulesSource} />}
            origin={originMeta}
          />
        );
      })}
    </ListSection>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  columnStack: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
  }),
});
