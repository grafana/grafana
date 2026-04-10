import { useEffect, useMemo } from 'react';

import { type CombinedRuleNamespace } from 'app/types/unified-alerting';

import { LogMessages, logInfo } from '../../Analytics';
import { ExternalRuleAction, RuleAction } from '../../hooks/abilities/types';
import { isCloudRulesSource, isGrafanaRulesSource } from '../../utils/datasource';
import { AbilityAny } from '../AbilityGuards';

import { CloudRules } from './CloudRules';
import { GrafanaRules } from './GrafanaRules';

interface Props {
  namespaces: CombinedRuleNamespace[];
  expandAll: boolean;
}

export const RuleListGroupView = ({ namespaces, expandAll }: Props) => {
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
      <AbilityAny actions={[RuleAction.View]}>
        <GrafanaRules namespaces={grafanaNamespaces} expandAll={expandAll} />
      </AbilityAny>
      <AbilityAny actions={[ExternalRuleAction.ViewAlertRule]}>
        <CloudRules namespaces={cloudNamespaces} expandAll={expandAll} />
      </AbilityAny>
    </>
  );
};
