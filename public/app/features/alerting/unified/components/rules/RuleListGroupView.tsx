import { CombinedRuleNamespace } from 'app/types/unified-alerting';
import React, { FC, useMemo } from 'react';
import { isCloudRulesSource, isGrafanaRulesSource } from '../../utils/datasource';
import { SystemOrApplicationRules } from './SystemOrApplicationRules';
import { ThresholdRules } from './ThresholdRules';

interface Props {
  namespaces: CombinedRuleNamespace[];
}

export const RuleListGroupView: FC<Props> = ({ namespaces }) => {
  const [thresholdNamespaces, systemNamespaces] = useMemo(() => {
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

  return (
    <>
      <ThresholdRules namespaces={thresholdNamespaces} />
      <SystemOrApplicationRules namespaces={systemNamespaces} />
    </>
  );
};
