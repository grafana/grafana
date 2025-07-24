import { zip } from 'lodash';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  CloudRuleIdentifier,
  GrafanaRulesSourceSymbol,
  RuleGroupIdentifierV2,
  RuleIdentifier,
} from 'app/types/unified-alerting';

import { logError, logMeasurement } from '../Analytics';
import { alertRuleApi } from '../api/alertRuleApi';
import { featureDiscoveryApi } from '../api/featureDiscoveryApi';
import * as ruleId from '../utils/rule-id';
import { getRuleName, isCloudRuleIdentifier } from '../utils/rules';

import { useAsync } from './useAsync';

const { useLazyPrometheusRuleNamespacesQuery, useLazyGetRuleGroupForNamespaceQuery } = alertRuleApi;
const { useLazyDiscoverDsFeaturesQuery } = featureDiscoveryApi;

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

const PREFER_CACHE_VALUE = true;

export function useRuleGroupIsInSync() {
  const [discoverDsFeatures] = useLazyDiscoverDsFeaturesQuery();
  const [fetchPrometheusRuleGroups] = useLazyPrometheusRuleNamespacesQuery();
  const [fetchRuleGroup] = useLazyGetRuleGroupForNamespaceQuery();

  const isGroupInSync = useCallback(
    async (ruleIdentifier: RuleGroupIdentifierV2) => {
      const dsUid =
        ruleIdentifier.groupOrigin === 'datasource' ? ruleIdentifier.rulesSource.uid : GrafanaRulesSourceSymbol;
      const dsFeatures = await discoverDsFeatures({ uid: dsUid }, PREFER_CACHE_VALUE).unwrap();

      if (!dsFeatures.rulerConfig) {
        throw new Error('Datasource does not support ruler. Unable to determine group consistency');
      }

      const namespace =
        ruleIdentifier.groupOrigin === 'datasource' ? ruleIdentifier.namespace.name : ruleIdentifier.namespace.uid;

      const promQueryParams: Parameters<typeof fetchPrometheusRuleGroups>[0] = {
        ruleSourceName: dsFeatures.name,
        namespace: namespace,
        groupName: ruleIdentifier.groupName,
        limitAlerts: 0,
        excludeAlerts: true,
      };
      const rulerParams: Parameters<typeof fetchRuleGroup>[0] = {
        namespace,
        group: ruleIdentifier.groupName,
        rulerConfig: dsFeatures.rulerConfig,
        notificationOptions: { showSuccessAlert: false, showErrorAlert: false },
      };

      const [promResponse, rulerResponse] = await Promise.allSettled([
        fetchPrometheusRuleGroups(promQueryParams).unwrap(),
        fetchRuleGroup(rulerParams).unwrap(),
      ]);

      if (promResponse.status === 'rejected' && rulerResponse.status === 'rejected') {
        // This means both requests failed. We can't determine if the state is consistent or not
        // and most probably mean there is a connectivity issue with the datasource
        // Let's return true so the UI is not disruptive for the user, but log an error to investigate how often this happens
        logError(
          new Error('Error fetching Prometheus and Ruler rule groups', {
            cause: [promResponse.reason, rulerResponse.reason],
          })
        );
        return true;
      }

      if (promResponse.status === 'rejected' && rulerResponse.status === 'fulfilled') {
        // This means Prometheus request error. It shouldn't reject even if there are no groups
        // matching the query params
        // Let's return true so the UI is not disruptive for the user, but log an error to investigate how often this happens
        logError(new Error('Error fetching Prometheus rule groups', { cause: promResponse.reason }));
        return true;
      }

      if (rulerResponse.status === 'rejected' && promResponse.status === 'fulfilled') {
        // We assume the group no longer exists in the ruler
        // The state is consistent if the group is not present in the Prometheus response
        const promGroups = promResponse.value.flatMap((ns) => ns.groups);
        return promGroups.every((g) => g.name !== ruleIdentifier.groupName);
      }

      if (promResponse.status === 'fulfilled' && rulerResponse.status === 'fulfilled') {
        const promGroup = promResponse.value
          .flatMap((ns) => ns.groups)
          .find((g) => g.name === ruleIdentifier.groupName);
        const rulerGroup = rulerResponse.value;

        if (promGroup && rulerGroup) {
          const rulesCountMatches = promGroup.rules.length === rulerGroup.rules.length;
          if (!rulesCountMatches) {
            return false;
          }

          const promRuleNames = promGroup.rules.map((r) => r.name);
          const rulerRuleNames = rulerGroup.rules.map(getRuleName);

          for (const [promName, rulerName] of zip(promRuleNames, rulerRuleNames)) {
            if (promName !== rulerName) {
              return false;
            }
          }

          return true;
        }
      }

      return false;
    },
    [discoverDsFeatures, fetchPrometheusRuleGroups, fetchRuleGroup]
  );

  return { isGroupInSync };
}

export function useRuleGroupConsistencyCheck() {
  const { isGroupInSync } = useRuleGroupIsInSync();
  const [groupConsistent, setGroupConsistent] = useState<boolean | undefined>();

  const apiCheckInterval = useRef<ReturnType<typeof setTimeout> | undefined>();
  const timeoutInterval = useRef<ReturnType<typeof setTimeout> | undefined>();

  useEffect(() => {
    return () => {
      clearTimeoutInterval();
      clearApiCheckInterval();
    };
  }, []);

  function clearTimeoutInterval() {
    if (timeoutInterval.current) {
      clearTimeout(timeoutInterval.current);
      timeoutInterval.current = undefined;
    }
  }

  function clearApiCheckInterval() {
    if (apiCheckInterval.current) {
      clearTimeout(apiCheckInterval.current);
      apiCheckInterval.current = undefined;
    }
  }

  /**
   * Waits for the rule group to be consistent between Prometheus and the Ruler.
   * It periodically fetches the group from the Prometheus and the Ruler and compares them.
   * Times out after 90 seconds of waiting.
   */
  async function waitForGroupConsistency(groupIdentifier: RuleGroupIdentifierV2) {
    // We can wait only for one rule group at a time
    clearTimeoutInterval();
    clearApiCheckInterval();

    const timeoutPromise = new Promise<void>((_, reject) => {
      timeoutInterval.current = setTimeout(() => {
        clearApiCheckInterval();
        const error = new Error('Timeout while waiting for rule group consistency');
        logError(error, { groupOrigin: groupIdentifier.groupOrigin });
        reject(error);
      }, CONSISTENCY_CHECK_TIMEOUT);
    });

    const waitPromise = new Promise<void>((resolve, reject) => {
      function logWaitingTime() {
        performance.mark('waitForGroupConsistency:finished');
        const duration = performance.measure(
          'waitForGroupConsistency',
          'waitForGroupConsistency:started',
          'waitForGroupConsistency:finished'
        );
        logMeasurement(
          'alerting:wait-for-group-consistency',
          { duration: duration.duration },
          { groupOrigin: groupIdentifier.groupOrigin }
        );
      }

      function checkGroupConsistency() {
        isGroupInSync(groupIdentifier)
          .then((inSync) => {
            setGroupConsistent(inSync);
            if (inSync) {
              logWaitingTime();
              resolve();
            } else {
              apiCheckInterval.current = setTimeout(checkGroupConsistency, CONSISTENCY_CHECK_POOL_INTERVAL);
            }
          })
          .catch((error) => {
            reject(error);
          })
          .finally(() => {
            clearTimeoutInterval();
          });
      }

      performance.mark('waitForGroupConsistency:started');
      checkGroupConsistency();
    });

    return Promise.race([timeoutPromise, waitPromise]);
  }

  return { waitForGroupConsistency, groupConsistent };
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
