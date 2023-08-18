import React, { useEffect, useMemo } from 'react';

import { logInfo } from '@grafana/runtime';
import { CombinedRuleNamespace } from 'app/types/unified-alerting';

import { LogMessages } from '../../Analytics';
import { AlertSourceAction } from '../../hooks/useAbilities';
import { isCloudRulesSource, isGrafanaRulesSource } from '../../utils/datasource';
import { Authorize } from '../Authorize';

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
      <Authorize actions={[AlertSourceAction.ViewAlertRule]}>
        <GrafanaRules namespaces={grafanaNamespaces} expandAll={expandAll} />
      </Authorize>
      <Authorize actions={[AlertSourceAction.ViewExternalAlertRule]}>
        <CloudRules namespaces={cloudNamespaces} expandAll={expandAll} />
      </Authorize>
    </>
  );
};
