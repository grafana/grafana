import { useCallback, useEffect, useRef, useState } from 'react';
import { useInterval } from 'react-use';

import { CloudRuleIdentifier, RuleIdentifier } from 'app/types/unified-alerting';

import { alertRuleApi } from '../api/alertRuleApi';
import * as ruleId from '../utils/rule-id';
import { isGrafanaRuleIdentifier } from '../utils/rules';

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
  // GMA rules use the Ruler API so no need to check consistency.
  useEffect(() => {
    if (!ruleLocation || isGrafanaRuleIdentifier(ruleIdentifier)) {
      return;
    }

    checkConsistency(ruleLocation);
  }, [ruleLocation, checkConsistency, ruleIdentifier]);

  return { isConsistent, loading, error };
}

const { setInterval, clearInterval } = window;

export function usePrometheusRemovalConsistencyCheck() {
  const [fetchPrometheusNamespaces] = useLazyPrometheusRuleNamespacesQuery();
  const consistencyInterval = useRef<number | undefined>();

  useEffect(() => {
    return () => {
      if (consistencyInterval.current) {
        clearInterval(consistencyInterval.current);
      }
    };
  }, []);

  // TODO Need to add support for GMA
  const isPrometheusConsistent = useCallback(
    async (ruleSourceName: string, ruleIdentifier: CloudRuleIdentifier) => {
      const { namespace, groupName, ruleName } = ruleIdentifier;

      const namespaces = await fetchPrometheusNamespaces({
        ruleSourceName,
        namespace,
        groupName,
        ruleName,
      }).unwrap();

      // If there is no matching group, the whole group has been deleted.
      const matchingGroup = namespaces.find((ns) => ns.name === namespace)?.groups.find((g) => g.name === groupName);
      if (!matchingGroup) {
        return true;
      }

      // If there is no matching rule, the rule has been deleted.
      const hasNoMatchingRule = matchingGroup.rules.every((r) => {
        const currentRuleIdentifier = ruleId.fromRule(ruleSourceName, namespace, groupName, r);
        return ruleId.equal(currentRuleIdentifier, ruleIdentifier) === false;
      });

      return hasNoMatchingRule;
    },
    [fetchPrometheusNamespaces]
  );

  async function waitForConsistency(ruleIdentifier: CloudRuleIdentifier) {
    // We can wait only for one rule at a time
    if (consistencyInterval.current) {
      clearInterval(consistencyInterval.current);
    }

    return new Promise((resolve) => {
      consistencyInterval.current = setInterval(() => {
        isPrometheusConsistent(ruleIdentifier.ruleSourceName, ruleIdentifier).then((isConsistent) => {
          if (isConsistent) {
            clearInterval(consistencyInterval.current);
            consistencyInterval.current = undefined;
            resolve(true);
          }
        });
      }, CONSISTENCY_CHECK_POOL_INTERVAL);
    });
  }

  return { waitForConsistency };
}
