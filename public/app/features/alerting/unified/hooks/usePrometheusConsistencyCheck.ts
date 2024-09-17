import { useCallback, useEffect, useState } from 'react';
import { useInterval } from 'react-use';

import { RuleIdentifier } from 'app/types/unified-alerting';

import { alertRuleApi } from '../api/alertRuleApi';
import * as ruleId from '../utils/rule-id';

import { RuleLocation, useRuleLocation } from './useCombinedRule';

const { useLazyPrometheusRuleNamespacesQuery } = alertRuleApi;

const CONSISTENCY_CHECK_POOL_INTERVAL = 3000;

export function usePrometheusConsistencyCheck(ruleIdentifier: RuleIdentifier) {
  const [fetchPrometheusNamespaces] = useLazyPrometheusRuleNamespacesQuery();

  // We expect the rule to be consistent more often than not, so we start with true.
  const [isConsistent, setIsConsistent] = useState(true);

  const { result: ruleLocation, loading, error } = useRuleLocation(ruleIdentifier);

  const isPrometheusConsistent = useCallback(
    async (ruleSourceName: string, ruleLocation: RuleLocation) => {
      const { namespace, group, ruleName } = ruleLocation;
      const namespaces = await fetchPrometheusNamespaces({
        ruleSourceName,
        namespace,
        groupName: group,
        ruleName,
      }).unwrap();
      const matchingGroup = namespaces.find((ns) => ns.name === namespace)?.groups.find((g) => g.name === group);

      const hasMatchingRule = matchingGroup?.rules.some((r) => {
        const currentRuleIdentifier = ruleId.fromRule(ruleSourceName, namespace, group, r);
        return ruleId.equal(currentRuleIdentifier, ruleIdentifier);
      });

      return hasMatchingRule ?? false;
    },
    [fetchPrometheusNamespaces, ruleIdentifier]
  );

  const checkConsistency = useCallback(
    async (location: RuleLocation) => {
      const isConsistent = await isPrometheusConsistent(ruleIdentifier.ruleSourceName, location);
      setIsConsistent(isConsistent);
    },
    [ruleIdentifier.ruleSourceName, isPrometheusConsistent]
  );

  useInterval(
    async () => {
      if (!ruleLocation) {
        return;
      }

      await checkConsistency(ruleLocation);
    },
    isConsistent ? null : CONSISTENCY_CHECK_POOL_INTERVAL // Null stops the interval
  );

  // By default the isConsistent is true as this should be the case most of the time.
  // We only want to run interval check if the rule is actually inconsistent.
  useEffect(() => {
    if (!ruleLocation) {
      return;
    }

    checkConsistency(ruleLocation);
  }, [ruleLocation, checkConsistency]);

  return { isConsistent, loading, error };
}
