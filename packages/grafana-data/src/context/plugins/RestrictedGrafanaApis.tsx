import { createContext, type ReactElement, type PropsWithChildren, useMemo, useContext } from 'react';

// Generic schema type to avoid zod dependency in @grafana/data
interface ZodSchema {
  parse: (data: unknown) => unknown;
  safeParse: (data: unknown) => { success: boolean; data?: unknown; error?: unknown };
}

/** Outcome of a single {@link DashboardMutationAPI.execute} call. */
export interface DashboardMutationResult {
  /** Whether the command ran to completion. */
  success: boolean;
  /** Why the command did not run, or failed. Set whenever `success` is false. */
  error?: string;
  /**
   * What the command changed, one entry per mutated path. Always empty when
   * `success` is false: a failed command leaves the dashboard untouched.
   */
  changes: Array<{ path: string; previousValue: unknown; newValue: unknown }>;
  /** Non-fatal problems. Present on successful calls too. */
  warnings?: string[];
  /** Command-specific payload, such as the read state for a read command. */
  data?: unknown;
}

/** A command that cannot run, and why. */
export interface BlockedDashboardMutation {
  /** The command name, upper-cased. */
  command: string;
  /**
   * Why it cannot run: an unrecognised command name, no dashboard open,
   * insufficient permission, a snapshot, or a disabled feature toggle.
   */
  reason: string;
}

/**
 * Whether a set of commands can run. Every blocked command is reported, not
 * just the first, so a caller gating on several commands learns all of the
 * reasons at once.
 */
export type DashboardMutationPermission = { allowed: true } | { allowed: false; blocked: BlockedDashboardMutation[] };

/**
 * Command-based API for reading and modifying the dashboard the user has open.
 *
 * Commands are dispatched by name through {@link execute}. Each one declares a
 * payload schema, a permission check, and whether it writes, so callers describe
 * the change they want rather than manipulating dashboard internals.
 *
 * Writes apply to the open dashboard in place and are not persisted. Saving
 * stays with the user, and there is no command for it.
 *
 * Two lifetimes are involved, which is the distinction most of these methods
 * exist to make visible:
 *
 * - This API object is created when Grafana starts and is available for as long
 *   as the app is running.
 * - The commands it dispatches to belong to the open dashboard, and come and go
 *   as the user navigates. {@link isAvailable} reports whether one is there.
 *
 * So holding this object means the host supports dashboard mutation, not that
 * there is a dashboard to mutate.
 */
export interface DashboardMutationAPI {
  /**
   * Run a command against the open dashboard.
   *
   * `type` is a command name, matched case-insensitively. `payload` must satisfy
   * that command's schema, which {@link getPayloadSchema} returns.
   *
   * Rejects when no dashboard is open. Everything else resolves with
   * `success: false` and an `error`: an unrecognised command name, a payload
   * that fails validation, a command the current user or dashboard state does
   * not permit, or an error raised while applying the change.
   */
  execute(mutation: { type: string; payload: unknown }): Promise<DashboardMutationResult>;
  /**
   * The Zod schema a command's payload must satisfy, or `null` for a command
   * this Grafana version does not implement. `commandId` is matched
   * case-insensitively.
   *
   * Schemas come from the static command registry, so this answers with no
   * dashboard open. That makes a `null` return usable as a version check, which
   * {@link getAvailableCommands} cannot be, since it is empty either when the
   * version lacks the command or when no dashboard is open.
   */
  getPayloadSchema(commandId: string): ZodSchema | null;
  /**
   * The commands {@link execute} can dispatch right now. Empty when no dashboard
   * is open.
   *
   * Listing a command means it exists and has a dashboard to act on, not that
   * this call will succeed. Permissions, snapshot state, and feature toggles are
   * evaluated per command inside {@link execute}, so a listed command can still
   * come back with `success: false`.
   */
  getAvailableCommands(): string[];
  /**
   * Whether the given commands would be permitted right now, without executing
   * them. Accepts one command or several, matched case-insensitively, and is
   * all-of: `allowed` is true only when every command passes.
   *
   * This runs the same per-command checks {@link execute} runs, so it covers what
   * {@link getAvailableCommands} cannot: no dashboard open, a command this
   * version does not implement, insufficient permission, a snapshot, and
   * commands behind a disabled feature toggle. Use it to decide whether to offer
   * a capability at all.
   *
   * An empty list is vacuously allowed, since there is nothing to check.
   */
  canExecute(commands: string | string[]): DashboardMutationPermission;
  /** Whether a dashboard is open, so {@link execute} has something to act on. */
  isAvailable(): boolean;
  /**
   * Observe dashboards being opened and closed. Returns a function that
   * unsubscribes.
   *
   * The listener receives the new availability, and is also called with `true`
   * when one dashboard replaces another, since commands then dispatch against a
   * different dashboard.
   *
   * It is not called on subscribe. Read {@link isAvailable} for the current
   * state.
   */
  onAvailabilityChange(listener: (isAvailable: boolean) => void): () => void;
}

interface RestrictedGrafanaApisContextTypeInternal {
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
