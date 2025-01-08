import { css } from '@emotion/css';
import { useMemo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Counter, Pagination, Stack, useStyles2 } from '@grafana/ui';
import { DEFAULT_PER_PAGE_PAGINATION } from 'app/core/constants';
import { CombinedRule, CombinedRuleNamespace } from 'app/types/unified-alerting';
import { PromAlertingRuleState } from 'app/types/unified-alerting-dto';

import { usePagination } from '..//hooks/usePagination';
import { calculateTotalInstances } from '../components/rule-viewer/RuleViewer';
import { ListSection } from '../rule-list/components/ListSection';
import { groupIdentifier } from '../utils/groupIdentifier';
import { createViewLink } from '../utils/misc';
import { hashRule } from '../utils/rule-id';
import { getRulePluginOrigin, isAlertingRule, isGrafanaRulerRule } from '../utils/rules';

import { AlertRuleListItem } from './components/AlertRuleListItem';
import { ActionsLoader, RuleActionsButtons } from './components/RuleActionsButtons.V2';

interface Props {
  namespaces: CombinedRuleNamespace[];
}

type GroupedRules = Map<PromAlertingRuleState, CombinedRule[]>;

export const StateView = ({ namespaces }: Props) => {
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
        const instancesCount = isAlertingRule(rule.promRule) ? calculateTotalInstances(rule.instanceTotals) : undefined;
        const groupId = groupIdentifier.fromCombinedRule(rule);

        if (!promRule) {
          return null;
        }

        const originMeta = getRulePluginOrigin(promRule);

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
            actions={
              rule.rulerRule ? (
                <RuleActionsButtons compact rule={rule.rulerRule} promRule={promRule} groupIdentifier={groupId} />
              ) : (
                <ActionsLoader />
              )
            }
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
