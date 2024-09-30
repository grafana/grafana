import { isNumber } from 'lodash';
import { useMemo } from 'react';

import { intervalToAbbreviatedDurationString } from '@grafana/data';
import { Counter, Pagination, Stack, Text, TextLink } from '@grafana/ui';
import { DEFAULT_PER_PAGE_PAGINATION } from 'app/core/constants';
import { CombinedRule, CombinedRuleNamespace } from 'app/types/unified-alerting';
import { PromAlertingRuleState } from 'app/types/unified-alerting-dto';

import { usePagination } from '../../hooks/usePagination';
import { PluginOriginBadge } from '../../plugins/PluginOriginBadge';
import { createViewLink } from '../../utils/misc';
import { hashRule } from '../../utils/rule-id';
import { getFirstActiveAt, getRulePluginOrigin, isAlertingRule, isGrafanaRulerRule } from '../../utils/rules';
import { MetaText } from '../MetaText';
import { ProvisioningBadge } from '../Provisioning';
import { AlertRuleListItem, RuleLocation } from '../rule-list/components/AlertRuleListItem';
import { Namespace } from '../rule-list/components/Namespace';
import { calculateTotalInstances } from '../rule-viewer/RuleViewer';

import { RuleActionsButtons } from './RuleActionsButtons';
interface Props {
  namespaces: CombinedRuleNamespace[];
}

type GroupedRules = Record<PromAlertingRuleState, CombinedRule[]>;

export const RuleListStateView = ({ namespaces }: Props) => {
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
    <Stack direction="column">
      {Object.entries(groupedRules).map(([state, rules]) => (
        <RulesByState key={state} state={state as PromAlertingRuleState} rules={rules} />
      ))}
    </Stack>
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
    <Namespace
      name={
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

        const numInstances = isAlertingRule(rule.promRule) ? calculateTotalInstances(rule.instanceTotals) : null;
        const firstActiveAt = isAlertingRule(promRule) ? getFirstActiveAt(promRule) : null;

        if (!promRule) {
          return null;
        }

        const originMeta = getRulePluginOrigin(rule);

        return (
          <AlertRuleListItem
            key={hashRule(promRule)}
            state={state as PromAlertingRuleState}
            title={
              <Stack direction="row" alignItems="center">
                <TextLink href={createViewLink(rule.namespace.rulesSource, rule)} inline={false}>
                  {rule.name}
                </TextLink>
                {isProvisioned && <ProvisioningBadge />}
              </Stack>
            }
            error={rule.promRule?.lastError}
            description={
              <Text variant="bodySmall" color="secondary">
                {rule.annotations.summary}
              </Text>
            }
            actions={<RuleActionsButtons compact rule={rule} rulesSource={rule.namespace.rulesSource} />}
            metaRight={
              <>
                {originMeta && <PluginOriginBadge pluginId={originMeta.pluginId} size="sm" />}
                {isNumber(numInstances) ? <MetaText icon="layer-group">{numInstances}</MetaText> : null}
              </>
            }
            meta={
              <>
                {rule.namespace.name && rule.group.name && (
                  <Text color="secondary" variant="bodySmall">
                    <RuleLocation namespace={rule.namespace} group={rule.group.name} />
                  </Text>
                )}
                {state === PromAlertingRuleState.Firing && firstActiveAt && (
                  <MetaText icon="clock-nine">
                    Firing for{' '}
                    <span title={firstActiveAt.toLocaleString()}>
                      {intervalToAbbreviatedDurationString({
                        start: firstActiveAt,
                        end: Date.now(),
                      })}
                    </span>
                  </MetaText>
                )}
                {state === PromAlertingRuleState.Pending && firstActiveAt && (
                  <MetaText icon="clock-nine">
                    Pending for{' '}
                    {intervalToAbbreviatedDurationString({
                      start: firstActiveAt,
                      end: Date.now(),
                    })}
                  </MetaText>
                )}
              </>
            }
          />
        );
      })}
    </Namespace>
  );
};
