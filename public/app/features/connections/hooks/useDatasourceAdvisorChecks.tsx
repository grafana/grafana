import { createContext, type ReactNode, useCallback, useContext, useLayoutEffect, useMemo, useState } from 'react';

import {
  type Check,
  type CheckList,
  type CheckType,
  useGetCheckTypeQuery,
} from '@grafana/api-clients/rtkq/advisor/v0alpha1';
import { PluginExtensionPoints } from '@grafana/data';
import { usePluginFunctions } from '@grafana/runtime';

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

type CreateChecksFn = () => {
  createChecks: () => void;
  createCheckState?: {
    isLoading?: boolean;
  };
};

interface AdvisorCheckContextValue {
  check?: Check;
  isLoading: boolean;
  isAvailable: boolean;
  retryCheck?: (checkName: string, itemID: string) => void;
  createChecks?: () => void;
  isCreatingChecks?: boolean;
}

// Data produced by the bridge from the plugin's hook functions; availability is
// derived by the provider, not the bridge, so it's excluded here.
type AdvisorCheckData = Omit<AdvisorCheckContextValue, 'isAvailable'>;

const AdvisorCheckContext = createContext<AdvisorCheckContextValue>({ isLoading: false, isAvailable: false });

/**
 * Provides advisor check data to descendant hooks via context.
 * Uses a headless bridge component to call the plugin's hook-based functions
 * only after they are loaded, avoiding React hook ordering violations.
 */
export function AdvisorCheckProvider({ children }: { children: ReactNode }) {
  const [advisorData, setAdvisorData] = useState<AdvisorCheckData | null>(null);

  const { functions: completedChecksFns, isLoading: isLoadingCompletedChecks } = usePluginFunctions<CompletedChecksFn>({
    extensionPointId: PluginExtensionPoints.AdvisorCompletedChecks,
  });
  const { functions: retryCheckFns, isLoading: isLoadingRetryChecks } = usePluginFunctions<RetryCheckFn>({
    extensionPointId: PluginExtensionPoints.AdvisorRetryCheck,
  });
  const { functions: createChecksFns, isLoading: isLoadingCreateChecks } = usePluginFunctions<CreateChecksFn>({
    extensionPointId: PluginExtensionPoints.AdvisorCreateChecks,
  });

  const completedChecksFn = completedChecksFns.find((f) => f.pluginId === ADVISOR_PLUGIN_ID)?.fn;
  const retryCheckFn = retryCheckFns.find((f) => f.pluginId === ADVISOR_PLUGIN_ID)?.fn;
  const createChecksFn = createChecksFns.find((f) => f.pluginId === ADVISOR_PLUGIN_ID)?.fn;
  const isLoadingPlugins = isLoadingCompletedChecks || isLoadingRetryChecks || isLoadingCreateChecks;
  const isPluginReady = !isLoadingPlugins && !!completedChecksFn && !!retryCheckFn;

  const contextValue = useMemo<AdvisorCheckContextValue>(() => {
    if (!isPluginReady) {
      return { isLoading: isLoadingPlugins, isAvailable: false };
    }
    if (!advisorData) {
      return { isLoading: true, isAvailable: true };
    }
    return { ...advisorData, isAvailable: true };
  }, [isPluginReady, isLoadingPlugins, advisorData]);

  return (
    <AdvisorCheckContext.Provider value={contextValue}>
      {isPluginReady && completedChecksFn && retryCheckFn && (
        <AdvisorCheckBridge
          completedChecksFn={completedChecksFn}
          retryCheckFn={retryCheckFn}
          createChecksFn={createChecksFn}
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
  createChecksFn,
  onChange,
}: {
  completedChecksFn: CompletedChecksFn;
  retryCheckFn: RetryCheckFn;
  createChecksFn?: CreateChecksFn;
  onChange: (value: AdvisorCheckData) => void;
}) {
  const completedChecks = completedChecksFn({ checkType: 'datasource' });
  const retryCheckResult = retryCheckFn();
  const createChecksResult = createChecksFn?.();

  const check = getLatestCheck(completedChecks?.data?.items);
  const isLoading = completedChecks == null || completedChecks.isLoading || !completedChecks.isCompleted;
  const retryCheck = retryCheckResult?.retryCheck;
  const createChecks = createChecksResult?.createChecks;
  const isCreatingChecks = Boolean(createChecksResult?.createCheckState?.isLoading || !completedChecks?.isCompleted);

  useLayoutEffect(() => {
    onChange({ check, isLoading, retryCheck, createChecks, isCreatingChecks });
  }, [check, isLoading, retryCheck, createChecks, isCreatingChecks, onChange]);

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
  /** Whether the advisor plugin is available to evaluate datasources. */
  isAvailable: boolean;
  /** Whether advisor has produced a completed datasource check. When false, no datasource has been evaluated yet. */
  hasCheck: boolean;
};

/**
 * Returns a Map of datasource UIDs that have any failure in the latest datasource
 * advisor check, to the highest severity among their failures.
 */
export function useDatasourceFailureByUID(): DatasourceFailuresResult {
  const { check, isLoading, isAvailable } = useContext(AdvisorCheckContext);
  const { data: checkType, isLoading: isCheckTypeLoading } = useGetCheckTypeQuery(
    { name: 'datasource' },
    { skip: !isAvailable }
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

  // A check object can exist before it has produced a report (created but not
  // yet completed); only treat it as evaluated once the report is present.
  const hasCheck = Boolean(check?.status?.report);

  return { datasourceFailureByUID, isLoading: isLoading || isCheckTypeLoading, isAvailable, hasCheck };
}

/**
 * Returns the most recently created check. The advisor API returns every check for
 * the type ordered by name (not by date), so the latest report must be selected by
 * creationTimestamp rather than by list position.
 */
function getLatestCheck(checks: Check[] | undefined): Check | undefined {
  if (!checks?.length) {
    return undefined;
  }
  return checks.reduce((latest, current) => {
    const latestTime = new Date(latest.metadata.creationTimestamp ?? 0).getTime();
    const currentTime = new Date(current.metadata.creationTimestamp ?? 0).getTime();
    return currentTime > latestTime ? current : latest;
  });
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
      if (!checkName || !retryCheck) {
        return;
      }

      retryCheck(checkName, datasourceUID);
    },
    [check?.metadata.name, retryCheck]
  );
}

/**
 * Returns a callback that starts advisor checks across datasource check types.
 * No-ops when advisor is disabled or the plugin function is unavailable.
 */
export function useCreateDatasourceAdvisorChecks(): {
  createChecks: () => void;
  isCreatingChecks: boolean;
  isAvailable: boolean;
} {
  const { createChecks, isCreatingChecks } = useContext(AdvisorCheckContext);
  const isAvailable = Boolean(createChecks);

  const runCreateChecks = useCallback(() => {
    if (!isAvailable || !createChecks) {
      return;
    }

    createChecks();
  }, [createChecks, isAvailable]);

  return {
    createChecks: runCreateChecks,
    isCreatingChecks: Boolean(isCreatingChecks),
    isAvailable,
  };
}
