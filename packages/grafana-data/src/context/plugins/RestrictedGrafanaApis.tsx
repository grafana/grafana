import { createContext, type ReactElement, type PropsWithChildren, useMemo, useContext } from 'react';

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
  execute(mutation: { type: string; payload: unknown }): Promise<DashboardMutationResult>;
  getPayloadSchema(commandId: string): ZodSchema | null;
  getAvailableCommands(): string[];
}

/**
 * Composer for dashboards and, on their own route, notebooks. Only the entry point is typed here; consumers
 * declare the session contract themselves and check it at runtime until the shape settles.
 *
 * @alpha
 */
interface ComposerAPI {
  readonly version: 1;
  canEnter(target?: {
    resource: 'dashboard' | 'notebook';
    uid: string;
  }): { ok: true } | { ok: false; reason: 'no_document' | 'no_permission' | 'unsupported' };
  enter(
    target?: { resource: 'dashboard' | 'notebook'; uid: string },
    options?: { presentation?: 'floating' | 'none' }
  ): Promise<unknown>;
  /**
   * Without `options`, the listener enters Composer on dashboards only. Return `false` from the listener to
   * decline a request; it then ends at once.
   */
  onEnterRequested(
    listener: (target: { resource: 'dashboard' | 'notebook'; uid: string }) => boolean | void,
    options?: { resources?: Array<'dashboard' | 'notebook'> }
  ): () => void;
}

/**
 * Lays out the extension sidebar. `docked` is a column next to the page; `floating` lays the sidebar over the
 * page in its bottom-right corner. The extension reads the current layout from its
 * `extensionSidebarPresentation` prop; switching never remounts it.
 */
export interface ExtensionSidebarAPI {
  /** Whether `setPresentation('floating')` has an effect in this Grafana. */
  canFloat(): boolean;
  /** Sets the layout. `floating` is ignored while `canFloat()` is false. */
  setPresentation(presentation: 'docked' | 'floating'): void;
  /**
   * Calls `listener` when the user asks to collapse the floating sidebar: by dragging it to the bottom edge of the
   * page (`method: 'drag'`), or by resizing it down to its collapsed height (`method: 'resize'`, see `setSizing`).
   * `input` says whether the pointer or the keyboard asked, so the extension can move focus after a keyboard
   * collapse. The extension owns what collapsed means. Core offers both only while a listener is subscribed, so
   * subscribe only while there is something to collapse. Returns the unsubscribe.
   */
  subscribeToCollapse(
    listener: (request?: { method: 'drag' | 'resize'; input: 'pointer' | 'keyboard' }) => void
  ): () => void;
  /**
   * Whether dragging the extension's drag handle (`data-extension-floating-drag-handle`) out of the docked sidebar
   * onto the page floats it there. Show a handle in the docked sidebar only while this is true.
   */
  canDragToFloat(): boolean;
  /**
   * Tells core which sizes the extension can show, so core's resize handles keep to them. Each call replaces the
   * previous one; a layout or axis left out, or `null`, gets core's default. Core forgets it when the sidebar closes
   * or shows another extension. Absent on a Grafana that resizes nothing on the extension's behalf.
   */
  setSizing?(
    sizing: {
      floating?: {
        /**
         * Lets core resize the floating sidebar's height from its top edge and top-left corner, as it resizes the
         * width from its left edge. Once the user resizes it, core sets `--extension-sidebar-floating-height` on the
         * sidebar for the extension to size its surface with; until then the extension's own height applies. Left
         * out, for example while the extension is collapsed, core shows no height handles.
         */
        height?: {
          /** The least height the user can resize it to, in px. */
          min: number;
          /**
           * The extension's collapsed height, in px. While `subscribeToCollapse` has a listener, a drag follows below
           * `min` down to it, and a release nearer to it than to `min` asks the extension to collapse.
           */
          collapsed?: number;
        };
      };
    } | null
  ): void;
  // The five members below are absent while `grafana.extensionSidebarPlacements` is off, so an extension keeps the
  // controls it shows on a Grafana without them.
  /**
   * Calls `listener` when the user asks to open the extension in a new window, from the top bar Chat button's menu.
   * Core opens the sidebar first if it is closed, and calls `listener` during the user's click, so the extension can
   * open a window then. Core offers the request only while a listener is subscribed, so subscribe only while the
   * browser can open the window. Returns the unsubscribe.
   */
  subscribeToPopOut?(listener: () => void): () => void;
  /**
   * Tells core the extension shows in a window of its own until the returned function is called, so the top bar Chat
   * button's menu marks it there. When the user moves the sidebar from that menu, core calls `popIn` first, so the
   * extension can bring itself back before core moves it.
   */
  trackPopOut?(popIn: () => void): () => void;
  /**
   * Where the extension's sidebar shows, or opens while it is closed: docked on the `left`, `right` or `bottom` edge
   * of the page, or `floating` over it. The same placement core's top bar menu shows. Only an extension that can float
   * moves; any other always docks on the right.
   */
  getPlacement?(): 'left' | 'right' | 'bottom' | 'floating';
  /** Moves the sidebar there, for every page, as core's top bar menu does. */
  setPlacement?(placement: 'left' | 'right' | 'bottom' | 'floating'): void;
  /** Calls `listener` whenever the placement may have changed, from any control. Returns the unsubscribe. */
  subscribeToPlacement?(listener: () => void): () => void;
}

interface RestrictedGrafanaApisContextTypeInternal {
  // Add types for restricted Grafana APIs here
  // (Make sure that they are typed as optional properties)
  alertingAlertRuleFormSchema?: ZodSchema;
  dashboardMutationAPI?: DashboardMutationAPI;
  composer?: ComposerAPI;
  extensionSidebar?: ExtensionSidebarAPI;
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

/**
 * The APIs in `apis` that `pluginId` may have under the allow and block lists: the allow list takes precedence,
 * and without one, an API is shared unless the block list names the plugin. What
 * `RestrictedGrafanaApisContextProvider` provides, and what Grafana hands an app plugin's module at load
 * (`AppPlugin.onRestrictedApis`).
 *
 * @internal
 */
export function getAllowedRestrictedGrafanaApis({
  pluginId,
  apis,
  apiAllowList,
  apiBlockList,
}: Props): RestrictedGrafanaApisContextType {
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
}

export function RestrictedGrafanaApisContextProvider(props: PropsWithChildren<Props>): ReactElement {
  const { children, pluginId, apis, apiAllowList, apiBlockList } = props;
  const allowedApis = useMemo(
    () => getAllowedRestrictedGrafanaApis({ pluginId, apis, apiAllowList, apiBlockList }),
    [apis, apiAllowList, apiBlockList, pluginId]
  );

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
