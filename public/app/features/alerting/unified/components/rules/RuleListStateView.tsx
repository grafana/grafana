import { isNumber } from 'lodash';
import { useMemo } from 'react';

import { Counter, Stack, Text, TextLink } from '@grafana/ui';
import { CombinedRule, CombinedRuleNamespace } from 'app/types/unified-alerting';
import { PromAlertingRuleState } from 'app/types/unified-alerting-dto';

import { createViewLink } from '../../utils/misc';
import { hashRule } from '../../utils/rule-id';
import { isAlertingRule, isGrafanaRulerRule } from '../../utils/rules';
import { MetaText } from '../MetaText';
import { ProvisioningBadge } from '../Provisioning';
import { AlertRuleListItem, Namespace, RuleLocation } from '../rule-list/components/components';
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
      [PromAlertingRuleState.Inactive]: [],
      [PromAlertingRuleState.Pending]: [],
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

  const titles: Record<PromAlertingRuleState, string> = {
    [PromAlertingRuleState.Firing]: 'Firing',
    [PromAlertingRuleState.Pending]: 'Pending',
    [PromAlertingRuleState.Inactive]: 'Normal',
  };

  return (
    <Stack direction="column">
      {Object.entries(groupedRules).map(([state, rules]) => (
        <Namespace
          name={
            <Stack alignItems="center" gap={0}>
              {titles[state as PromAlertingRuleState] ?? 'Unknown'}
              <Counter value={rules.length} />
            </Stack>
          }
          key={state}
          collapsed={rules.length === 0}
        >
          {rules.map((rule) => {
            const isProvisioned =
              isGrafanaRulerRule(rule.rulerRule) && Boolean(rule.rulerRule.grafana_alert.provenance);
            const numInstances = isAlertingRule(rule.promRule) ? calculateTotalInstances(rule.instanceTotals) : null;

            return (
              <AlertRuleListItem
                key={hashRule(rule.promRule!)}
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
                metaRight={isNumber(numInstances) ? <MetaText icon="layer-group">{numInstances}</MetaText> : null}
                meta={
                  <>
                    {rule.namespace.name && rule.group.name && (
                      <Text color="secondary" variant="bodySmall">
                        <RuleLocation namespace={rule.namespace} group={rule.group.name} />
                      </Text>
                    )}
                    {state === PromAlertingRuleState.Firing && <MetaText icon="clock-nine">Firing for 2m 34s</MetaText>}
                  </>
                }
              />
            );
          })}
        </Namespace>
      ))}
    </Stack>
  );
};
