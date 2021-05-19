import { CombinedRuleNamespace } from 'app/types/unified-alerting';
import React, { FC, useMemo } from 'react';
import { isCloudRulesSource, isGrafanaRulesSource } from '../../utils/datasource';
import { CloudRules } from './CloudRules';
import { GrafanaRules } from './GrafanaRules';

interface Props {
  namespaces: CombinedRuleNamespace[];
}

export const RuleListGroupView: FC<Props> = ({ namespaces }) => {
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

  return (
    <>
      <GrafanaRules namespaces={grafanaNamespaces} />
      <CloudRules namespaces={cloudNamespaces} />
    </>
  );
};
