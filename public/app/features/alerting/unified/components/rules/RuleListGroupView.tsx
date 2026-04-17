import { useEffect, useMemo } from 'react';

import { type CombinedRuleNamespace } from 'app/types/unified-alerting';

import { LogMessages, logInfo } from '../../Analytics';
import { isGranted } from '../../hooks/abilities/abilityUtils';
import { useExternalGlobalRuleAbility, useGlobalRuleAbility } from '../../hooks/abilities/ruleAbilities';
import { ExternalRuleAction, RuleAction } from '../../hooks/abilities/types';
import { isCloudRulesSource, isGrafanaRulesSource } from '../../utils/datasource';

import { CloudRules } from './CloudRules';
import { GrafanaRules } from './GrafanaRules';

interface Props {
  namespaces: CombinedRuleNamespace[];
  expandAll: boolean;
}

export const RuleListGroupView = ({ namespaces, expandAll }: Props) => {
  const canViewRules = isGranted(useGlobalRuleAbility(RuleAction.View));
  const canViewExternalRules = isGranted(useExternalGlobalRuleAbility(ExternalRuleAction.ViewAlertRule));

  const [grafanaNamespaces, cloudNamespaces] = useMemo(() => {
    const sorted = namespaces
      .map((namespace) => ({
        ...namespace,
        groups: namespace.groups.sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return [
      sorted.filter((ns) => isGrafanaRulesSource(ns.rulesSource)),
      sorted.filter((ns) => isCloudRulesSource(ns.rulesSource)),
    ];
  }, [namespaces]);

  useEffect(() => {
    logInfo(LogMessages.loadedList);
  }, []);

  return (
    <>
      {canViewRules && <GrafanaRules namespaces={grafanaNamespaces} expandAll={expandAll} />}
      {canViewExternalRules && <CloudRules namespaces={cloudNamespaces} expandAll={expandAll} />}
    </>
  );
};
