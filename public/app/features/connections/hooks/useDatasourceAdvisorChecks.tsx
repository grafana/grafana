import { createContext, type ReactNode, useCallback, useContext, useLayoutEffect, useMemo, useState } from 'react';

import {
  type Check,
  type CheckList,
  type CheckType,
  useGetCheckTypeQuery,
} from '@grafana/api-clients/rtkq/advisor/v0alpha1';
import { PluginExtensionPoints } from '@grafana/data';
import { config, usePluginFunctions } from '@grafana/runtime';

export type FailureSeverity = 'high' | 'low';

export type DatasourceFailureDetails = {
  severity: FailureSeverity;
  message?: string;
};

const EMPTY_MAP = new Map<string, DatasourceFailureDetails>();
const ADVISOR_PLUGIN_ID = 'grafana-advisor-app';

type CompletedChecksFn = (context?: { names?: string[]; checkType?: string }) => {
  isCompleted: boolean;
  isLoading: boolean;
  data?: CheckList;
};

type RetryCheckFn = () => {
  retryCheck: (checkName: string, itemID: string) => void;
};

function isAdvisorEnabled(): boolean {
  return Boolean(config.featureToggles.grafanaAdvisor && config.featureToggles.advisorDatasourceIntegration);
}

interface AdvisorCheckContextValue {
  check?: Check;
  isLoading: boolean;
  retryCheck?: (checkName: string, itemID: string) => void;
}

const AdvisorCheckContext = createContext<AdvisorCheckContextValue>({ isLoading: false });

/**
 * Provides advisor check data to descendant hooks via context.
 * Uses a headless bridge component to call the plugin's hook-based functions
 * only after they are loaded, avoiding React hook ordering violations.
 */
export function AdvisorCheckProvider({ children }: { children: ReactNode }) {
  const enabled = isAdvisorEnabled();
  const [advisorData, setAdvisorData] = useState<AdvisorCheckContextValue | null>(null);

  const { functions: completedChecksFns, isLoading: isLoadingCompletedChecks } = usePluginFunctions<CompletedChecksFn>({
    extensionPointId: PluginExtensionPoints.AdvisorCompletedChecks,
  });
  const { functions: retryCheckFns, isLoading: isLoadingRetryChecks } = usePluginFunctions<RetryCheckFn>({
    extensionPointId: PluginExtensionPoints.AdvisorRetryCheck,
  });

  const completedChecksFn = completedChecksFns.find((f) => f.pluginId === ADVISOR_PLUGIN_ID)?.fn;
  const retryCheckFn = retryCheckFns.find((f) => f.pluginId === ADVISOR_PLUGIN_ID)?.fn;
  const isPluginReady =
    enabled && !isLoadingCompletedChecks && !isLoadingRetryChecks && !!completedChecksFn && !!retryCheckFn;

  const contextValue = useMemo<AdvisorCheckContextValue>(() => {
    if (!enabled) {
      return { isLoading: false };
    }
    if (!isPluginReady || !advisorData) {
      return { isLoading: true };
    }
    return advisorData;
  }, [enabled, isPluginReady, advisorData]);

  return (
    <AdvisorCheckContext.Provider value={contextValue}>
      {isPluginReady && (
        <AdvisorCheckBridge
          completedChecksFn={completedChecksFn!}
          retryCheckFn={retryCheckFn!}
          onChange={setAdvisorData}
        />
      )}
      {children}
    </AdvisorCheckContext.Provider>
  );
}

/**
 * Headless component that calls the plugin's hook-based functions.
 * Only mounted when plugin functions are available, ensuring the
 * hooks inside fn() are called on every render of this component.
 */
function AdvisorCheckBridge({
  completedChecksFn,
  retryCheckFn,
  onChange,
}: {
  completedChecksFn: CompletedChecksFn;
  retryCheckFn: RetryCheckFn;
  onChange: (value: AdvisorCheckContextValue) => void;
}) {
  const completedChecks = completedChecksFn({ checkType: 'datasource' });
  const retryCheckResult = retryCheckFn();

  const check = completedChecks?.data?.items?.[0];
  const isLoading = completedChecks?.isLoading ?? true;
  const retryCheck = retryCheckResult?.retryCheck;

  useLayoutEffect(() => {
    onChange({ check, isLoading, retryCheck });
  }, [check, isLoading, retryCheck, onChange]);

  return null;
}

// --- Consumer hooks ---

/**
 * Returns the latest datasource advisor check from context.
 * Must be used inside an AdvisorCheckProvider.
 */
export function useLatestDatasourceCheck(): {
  check: Check | undefined;
  isLoading: boolean;
} {
  const { check, isLoading } = useContext(AdvisorCheckContext);
  return { check, isLoading };
}

export type DatasourceFailuresResult = {
  /** Map of datasource UID to the highest severity among its failures. Only datasources with at least one failure are included. */
  datasourceFailureByUID: Map<string, DatasourceFailureDetails>;
  isLoading: boolean;
};

/**
 * Returns a Map of datasource UIDs that have any failure in the latest datasource
 * advisor check, to the highest severity among their failures.
 */
export function useDatasourceFailureByUID(): DatasourceFailuresResult {
  const enabled = isAdvisorEnabled();
  const { check, isLoading } = useLatestDatasourceCheck();
  const { data: checkType, isLoading: isCheckTypeLoading } = useGetCheckTypeQuery(
    { name: 'datasource' },
    { skip: !enabled }
  );

  const datasourceFailureByUID = useMemo(() => {
    const failures = check?.status?.report?.failures;
    if (!failures?.length) {
      return EMPTY_MAP;
    }

    const stepByID = getStepMap(checkType);
    const byUID = new Map<string, DatasourceFailureDetails>();
    for (const failure of failures) {
      const uid = failure.itemID;
      const severity = failure.severity;
      const existing = byUID.get(uid);
      if (existing === undefined || (existing.severity !== 'high' && severity === 'high')) {
        const step = stepByID.get(failure.stepID);
        const message = step ? `${step.title} failed: ${step.resolution}` : undefined;
        byUID.set(uid, { severity, message });
      }
    }
    return byUID;
  }, [check, checkType]);

  return { datasourceFailureByUID, isLoading: isLoading || isCheckTypeLoading };
}

function getStepMap(checkType: CheckType | undefined): Map<string, CheckType['spec']['steps'][number]> {
  const stepByID = new Map<string, CheckType['spec']['steps'][number]>();
  for (const step of checkType?.spec.steps ?? []) {
    stepByID.set(step.stepID, step);
  }
  return stepByID;
}

/**
 * Returns a callback that retries the latest datasource advisor check for
 * the given datasource UID. No-ops when advisor is disabled or no check exists.
 */
export function useRetryDatasourceAdvisorCheck(): (datasourceUID: string) => Promise<void> {
  const { check, retryCheck } = useContext(AdvisorCheckContext);

  return useCallback(
    async (datasourceUID: string) => {
      const checkName = check?.metadata.name;
      if (!isAdvisorEnabled() || !checkName || !retryCheck) {
        return;
      }

      retryCheck(checkName, datasourceUID);
    },
    [check?.metadata.name, retryCheck]
  );
}
