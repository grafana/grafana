import { useCallback, useEffect, useRef } from 'react';

import { CloudRuleIdentifier, RuleIdentifier } from 'app/types/unified-alerting';

import { alertRuleApi } from '../api/alertRuleApi';
import * as ruleId from '../utils/rule-id';
import { isCloudRuleIdentifier } from '../utils/rules';

import { useAsync } from './useAsync';

const { useLazyPrometheusRuleNamespacesQuery } = alertRuleApi;

const CONSISTENCY_CHECK_POOL_INTERVAL = 3 * 1000; // 3 seconds;
const CONSISTENCY_CHECK_TIMEOUT = 90 * 1000; // 90 seconds

const { setInterval, clearInterval } = window;

function useMatchingPromRuleExists() {
  const [fetchPrometheusNamespaces] = useLazyPrometheusRuleNamespacesQuery();

  const matchingPromRuleExists = useCallback(
    async (ruleIdentifier: CloudRuleIdentifier) => {
      const { ruleSourceName, namespace, groupName, ruleName } = ruleIdentifier;
      const namespaces = await fetchPrometheusNamespaces({
        ruleSourceName,
        namespace,
        groupName,
        ruleName,
      }).unwrap();

      const matchingGroup = namespaces.find((ns) => ns.name === namespace)?.groups.find((g) => g.name === groupName);

      const hasMatchingRule = matchingGroup?.rules.some((r) => {
        const currentRuleIdentifier = ruleId.fromRule(ruleSourceName, namespace, groupName, r);
        return ruleId.equal(currentRuleIdentifier, ruleIdentifier);
      });

      return hasMatchingRule ?? false;
    },
    [fetchPrometheusNamespaces]
  );

  return { matchingPromRuleExists };
}

export function usePrometheusConsistencyCheck() {
  const { matchingPromRuleExists } = useMatchingPromRuleExists();

  const removalConsistencyInterval = useRef<number | undefined>();
  const creationConsistencyInterval = useRef<number | undefined>();

  useEffect(() => {
    return () => {
      clearRemovalInterval();
      clearCreationInterval();
    };
  }, []);

  const clearRemovalInterval = () => {
    if (removalConsistencyInterval.current) {
      clearInterval(removalConsistencyInterval.current);
      removalConsistencyInterval.current = undefined;
    }
  };

  const clearCreationInterval = () => {
    if (creationConsistencyInterval.current) {
      clearInterval(creationConsistencyInterval.current);
      creationConsistencyInterval.current = undefined;
    }
  };

  async function waitForRemoval(ruleIdentifier: CloudRuleIdentifier) {
    // We can wait only for one rule at a time
    clearRemovalInterval();

    const timeoutPromise = new Promise<void>((_, reject) => {
      setTimeout(() => {
        clearRemovalInterval();
        reject(new Error('Timeout while waiting for rule removal'));
      }, CONSISTENCY_CHECK_TIMEOUT);
    });

    const waitPromise = new Promise<void>((resolve, reject) => {
      removalConsistencyInterval.current = setInterval(() => {
        matchingPromRuleExists(ruleIdentifier)
          .then((ruleExists) => {
            if (ruleExists === false) {
              clearRemovalInterval();
              resolve();
            }
          })
          .catch((error) => {
            clearRemovalInterval();
            reject(error);
          });
      }, CONSISTENCY_CHECK_POOL_INTERVAL);
    });

    return Promise.race([timeoutPromise, waitPromise]);
  }

  async function waitForCreation(ruleIdentifier: CloudRuleIdentifier) {
    // We can wait only for one rule at a time
    clearCreationInterval();

    const timeoutPromise = new Promise<void>((_, reject) => {
      setTimeout(() => {
        clearCreationInterval();
        reject(new Error('Timeout while waiting for rule creation'));
      }, CONSISTENCY_CHECK_TIMEOUT);
    });

    const waitPromise = new Promise<void>((resolve, reject) => {
      creationConsistencyInterval.current = setInterval(() => {
        matchingPromRuleExists(ruleIdentifier)
          .then((ruleExists) => {
            if (ruleExists === true) {
              clearCreationInterval();
              resolve();
            }
          })
          .catch((error) => {
            clearCreationInterval();
            reject(error);
          });
      }, CONSISTENCY_CHECK_POOL_INTERVAL);
    });

    return Promise.race([timeoutPromise, waitPromise]);
  }

  return { waitForRemoval, waitForCreation };
}

export function usePrometheusCreationConsistencyCheck(ruleIdentifier: RuleIdentifier) {
  const { matchingPromRuleExists } = useMatchingPromRuleExists();
  const { waitForCreation } = usePrometheusConsistencyCheck();

  const [actions, state] = useAsync(async (identifier: RuleIdentifier) => {
    if (isCloudRuleIdentifier(identifier)) {
      return waitForCreation(identifier);
    } else {
      // GMA rules are not supported yet
      return Promise.resolve();
    }
  });

  useEffect(() => {
    if (isCloudRuleIdentifier(ruleIdentifier)) {
      // We need to check if the rule exists first, because most of the times it does,
      // and wait for the consistency only if the rule does not exist.
      matchingPromRuleExists(ruleIdentifier).then((ruleExists) => {
        if (!ruleExists) {
          actions.execute(ruleIdentifier);
        }
      });
    }
  }, [actions, ruleIdentifier, matchingPromRuleExists]);

  return { isConsistent: state.status === 'success' || state.status === 'not-executed', error: state.error };
}
