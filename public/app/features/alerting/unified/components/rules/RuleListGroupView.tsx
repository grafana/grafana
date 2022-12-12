import React, { FC, useEffect, useMemo } from 'react';

import { logInfo } from '@grafana/runtime';
import { AccessControlAction } from 'app/types';
import { CombinedRuleNamespace } from 'app/types/unified-alerting';

import { LogMessages } from '../../Analytics';
import { isCloudRulesSource, isGrafanaRulesSource } from '../../utils/datasource';
import { Authorize } from '../Authorize';

import { CloudRules } from './CloudRules';
import { GrafanaRules } from './GrafanaRules';

interface Props {
  namespaces: CombinedRuleNamespace[];
  expandAll: boolean;
}

export const RuleListGroupView: FC<Props> = ({ namespaces, expandAll }) => {
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
      <Authorize actions={[AccessControlAction.AlertingRuleRead]}>
        <GrafanaRules namespaces={grafanaNamespaces} expandAll={expandAll} />
      </Authorize>
      <Authorize actions={[AccessControlAction.AlertingRuleExternalRead]}>
        <CloudRules namespaces={cloudNamespaces} expandAll={expandAll} />
      </Authorize>
    </>
  );
};
