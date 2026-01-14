import { useEffect, useMemo } from 'react';

import { CombinedRuleNamespace } from 'app/types/unified-alerting';

import { LogMessages, logInfo } from '../../Analytics';
import { AlertingAction } from '../../hooks/useAbilities';
import { isCloudRulesSource, isGrafanaRulesSource } from '../../utils/datasource';
import { sortRules } from '../../utils/rulesSorting';
import { Authorize } from '../Authorize';

import { CloudRules } from './CloudRules';
import { GrafanaRules } from './GrafanaRules';
import { RuleSortOrder, useRulesSorting } from './RulesSortingSelector';

interface Props {
  namespaces: CombinedRuleNamespace[];
  expandAll: boolean;
}

function applySortingToNamespaces(
  namespaces: CombinedRuleNamespace[],
  sortOrder: RuleSortOrder | undefined
): CombinedRuleNamespace[] {
  return namespaces.map((namespace) => ({
    ...namespace,
    groups: namespace.groups.map((group) => ({
      ...group,
      rules: sortRules(group.rules, sortOrder),
    })),
  }));
}

export const RuleListGroupView = ({ namespaces, expandAll }: Props) => {
  const { sortOrder } = useRulesSorting();

  const [grafanaNamespaces, cloudNamespaces] = useMemo(() => {
    const sorted = namespaces
      .map((namespace) => ({
        ...namespace,
        groups: namespace.groups.sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const sortedWithRules = applySortingToNamespaces(sorted, sortOrder);

    return [
      sortedWithRules.filter((ns) => isGrafanaRulesSource(ns.rulesSource)),
      sortedWithRules.filter((ns) => isCloudRulesSource(ns.rulesSource)),
    ];
  }, [namespaces, sortOrder]);

  useEffect(() => {
    logInfo(LogMessages.loadedList);
  }, []);

  return (
    <>
      <Authorize actions={[AlertingAction.ViewAlertRule]}>
        <GrafanaRules namespaces={grafanaNamespaces} expandAll={expandAll} />
      </Authorize>
      <Authorize actions={[AlertingAction.ViewExternalAlertRule]}>
        <CloudRules namespaces={cloudNamespaces} expandAll={expandAll} />
      </Authorize>
    </>
  );
};
