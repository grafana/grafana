import { css } from '@emotion/css';
import { useMemo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Counter, Pagination, Stack, useStyles2 } from '@grafana/ui';
import { DEFAULT_PER_PAGE_PAGINATION } from 'app/core/constants';
import { CombinedRule, CombinedRuleNamespace } from 'app/types/unified-alerting';
import { PromAlertingRuleState } from 'app/types/unified-alerting-dto';

import { usePagination } from '../../hooks/usePagination';
import { createViewLink } from '../../utils/misc';
import { hashRule } from '../../utils/rule-id';
import { getFirstActiveAt, getRulePluginOrigin, isAlertingRule, isGrafanaRulerRule } from '../../utils/rules';
import { AlertRuleListItem } from '../rule-list/components/AlertRuleListItem';
import { ListSection } from '../rule-list/components/ListSection';
import { calculateTotalInstances } from '../rule-viewer/RuleViewer';

import { RuleActionsButtons } from './RuleActionsButtons';
interface Props {
  namespaces: CombinedRuleNamespace[];
}

type GroupedRules = Record<PromAlertingRuleState, CombinedRule[]>;

export const RuleListStateView = ({ namespaces }: Props) => {
  const styles = useStyles2(getStyles);

  const groupedRules = useMemo(() => {
    const result: GroupedRules = {
      [PromAlertingRuleState.Firing]: [],
      [PromAlertingRuleState.Pending]: [],
      [PromAlertingRuleState.Inactive]: [],
    };

    namespaces.forEach((namespace) =>
      namespace.groups.forEach((group) =>
        group.rules.forEach((rule) => {
          // We might hit edge cases where there type = alerting, but there is no state.
          // In this case, we shouldn't try to group these alerts in the state view
          // Even though we handle this at the API layer, this is a last catch point for any edge cases
          if (rule.promRule && isAlertingRule(rule.promRule) && rule.promRule.state) {
            result[rule.promRule.state].push(rule);
          }
        })
      )
    );

    Object.values(result).forEach((rules) => rules.sort((a, b) => a.name.localeCompare(b.name)));

    return result;
  }, [namespaces]);

  return (
    <ul className={styles.columnStack} role="tree">
      {Object.entries(groupedRules).map(([state, rules]) => (
        <RulesByState key={state} state={state as PromAlertingRuleState} rules={rules} />
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

        const isProvisioned = isGrafanaRulerRule(rulerRule) && Boolean(rulerRule.grafana_alert.provenance);

        const instanceCount = isAlertingRule(rule.promRule) ? calculateTotalInstances(rule.instanceTotals) : undefined;
        const firstActiveAt = isAlertingRule(promRule) ? getFirstActiveAt(promRule) : null;

        if (!promRule) {
          return null;
        }

        const originMeta = getRulePluginOrigin(rule);

        return (
          <AlertRuleListItem
            key={hashRule(promRule)}
            state={state as PromAlertingRuleState}
            name={rule.name}
            href={createViewLink(rule.namespace.rulesSource, rule)}
            isProvisioned={isProvisioned}
            error={rule.promRule?.lastError}
            summary={rule.annotations.summary}
            actions={<RuleActionsButtons compact rule={rule} rulesSource={rule.namespace.rulesSource} />}
            instanceCount={instanceCount}
            origin={originMeta}
            namespace={rule.namespace}
            group={rule.group.name}
            firstActiveAt={firstActiveAt ?? undefined}
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
