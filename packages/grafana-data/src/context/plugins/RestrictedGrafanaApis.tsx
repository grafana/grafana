import { createContext, ReactElement, PropsWithChildren, useMemo, useContext } from 'react';

// Generic schema type to avoid zod dependency in @grafana/data
interface ZodSchema {
  parse: (data: unknown) => unknown;
  safeParse: (data: unknown) => { success: boolean; data?: unknown; error?: unknown };
}

export interface DashboardMutationResult {
  success: boolean;
  error?: string; // structured validation/execution error message
  changes: Array<{ path: string; previousValue: unknown; newValue: unknown }>;
  warnings?: string[];
  data?: unknown; // command-specific return data
}

export interface DashboardMutationAPI {
  // Execute a mutation on the active dashboard. Rejects if no dashboard is loaded.
  execute(mutation: { type: string; payload: unknown }): Promise<DashboardMutationResult>;
  // Get the Zod payload schema for a command (e.g. "ADD_VARIABLE"). Returns null if unknown.
  getPayloadSchema(commandId: string): ZodSchema | null;
}

export interface RestrictedGrafanaApisContextTypeInternal {
  // Add types for restricted Grafana APIs here
  // (Make sure that they are typed as optional properties)
  alertingAlertRuleFormSchema?: ZodSchema;
  dashboardMutationAPI?: DashboardMutationAPI;
}

// We are exposing this through a "type validation", to make sure that all APIs are optional (which helps plugins catering for scenarios when they are not available).
type RequireAllPropertiesOptional<T> = keyof T extends never
  ? T
  : { [K in keyof T]-?: undefined extends T[K] ? never : K }[keyof T] extends never
    ? T
    : 'Error: all properties of `RestrictedGrafanaApisContextTypeInternal` must be marked as optional, as their availability is controlled via a configuration parameter. Please have a look at `RestrictedGrafanaApisContextTypeInternal`.';
export type RestrictedGrafanaApisContextType = RequireAllPropertiesOptional<RestrictedGrafanaApisContextTypeInternal>;

// A type for allowing / blocking plugins for a given API
export type RestrictedGrafanaApisAllowList = Partial<
  Record<keyof RestrictedGrafanaApisContextType | string, Array<string | RegExp>>
>;

export const RestrictedGrafanaApisContext = createContext<RestrictedGrafanaApisContextType>({});

export type Props = {
  pluginId: string;
  apis: RestrictedGrafanaApisContextType;
  // Use it to share APIs with plugins (TAKES PRECEDENCE over `apiBlockList`)
  apiAllowList?: RestrictedGrafanaApisAllowList;
  // Use it to disable sharing APIs with plugins.
  apiBlockList?: RestrictedGrafanaApisAllowList;
};

export function RestrictedGrafanaApisContextProvider(props: PropsWithChildren<Props>): ReactElement {
  const { children, pluginId, apis, apiAllowList, apiBlockList } = props;
  const allowedApis = useMemo(() => {
    const allowedApis: RestrictedGrafanaApisContextType = {};

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    for (const api of Object.keys(apis) as Array<keyof RestrictedGrafanaApisContextType>) {
      if (
        apiAllowList &&
        apiAllowList[api] &&
        (apiAllowList[api].includes(pluginId) ||
          apiAllowList[api].some((keyword) => keyword instanceof RegExp && keyword.test(pluginId)))
      ) {
        // We use Object.assign below because direct assignment fails when the type has multiple optional properties
        // of different types (TS can't correlate the key-value pair through a dynamic index).
        Object.assign(allowedApis, { [api]: apis[api] });
        continue;
      }

      // IF no allow list is defined (only block list), then we only omit the blocked APIs
      if (
        (!apiAllowList || Object.keys(apiAllowList).length === 0) &&
        apiBlockList &&
        apiBlockList[api] &&
        !(
          apiBlockList[api].includes(pluginId) ||
          apiBlockList[api].some((keyword) => keyword instanceof RegExp && keyword.test(pluginId))
        )
      ) {
        // We use Object.assign below because direct assignment fails when the type has multiple optional properties
        // of different types (TS can't correlate the key-value pair through a dynamic index).
        Object.assign(allowedApis, { [api]: apis[api] });
      }
    }

    return allowedApis;
  }, [apis, apiAllowList, apiBlockList, pluginId]);

  return <RestrictedGrafanaApisContext.Provider value={allowedApis}>{children}</RestrictedGrafanaApisContext.Provider>;
}

export function useRestrictedGrafanaApis(): RestrictedGrafanaApisContextType {
  const context = useContext(RestrictedGrafanaApisContext);

  if (!context) {
    throw new Error(
      'useRestrictedGrafanaApis() can only be used inside a plugin context (The `RestrictedGrafanaApisContext` is not available).'
    );
  }

  return context;
}
