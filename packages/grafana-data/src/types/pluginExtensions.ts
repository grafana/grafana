import * as React from 'react';

import { DataQuery, DataSourceJsonData } from '@grafana/schema';

import { ScopedVars } from './ScopedVars';
import { DataSourcePluginMeta, DataSourceSettings } from './datasource';
import { IconName } from './icon';
import { PanelData } from './panel';
import { AbsoluteTimeRange, RawTimeRange, TimeZone } from './time';

// Plugin Extensions types
// ---------------------------------------

export enum PluginExtensionTypes {
  link = 'link',
  component = 'component',
  function = 'function',
}

type PluginExtensionBase = {
  id: string;
  type: PluginExtensionTypes;
  title: string;
  description: string;
  pluginId: string;
};
export type PluginExtensionLink = PluginExtensionBase & {
  type: PluginExtensionTypes.link;
  path?: string;
  onClick?: (event?: React.MouseEvent) => void;
  icon?: IconName;
  category?: string;
};

export type PluginExtensionComponentMeta = Omit<PluginExtensionComponent, 'component'>;

export type PluginExtensionComponent<Props = {}> = PluginExtensionBase & {
  type: PluginExtensionTypes.component;
  component: React.ComponentType<Props>;
};

export type ComponentTypeWithExtensionMeta<Props = {}> = React.ComponentType<Props> & {
  meta: PluginExtensionComponentMeta;
};

export type PluginExtensionFunction<Signature = () => void> = PluginExtensionBase & {
  type: PluginExtensionTypes.function;
  fn: Signature;
};

export type PluginExtension = PluginExtensionLink | PluginExtensionComponent | PluginExtensionFunction;

// Objects used for registering extensions (in app plugins)
// --------------------------------------------------------

type PluginExtensionConfigBase = {
  /**
   * The title of the link extension
   */
  title: string;

  /**
   * A short description
   */
  description?: string;
};

export type PluginExtensionAddedComponentConfig<Props = {}> = PluginExtensionConfigBase & {
  /**
   * The target extension points where the component will be added
   */
  targets: string | string[];

  /**
   * The title of the component
   */
  title: string;

  /**
   * A short description of the component
   */
  description: string;

  /**
   * The React component that will added to the target extension points
   */
  component: React.ComponentType<Props>;
};
export type PluginExtensionAddedFunctionConfig<Signature = unknown> = PluginExtensionConfigBase & {
  /**
   * The target extension points where the component will be added
   */
  targets: string | string[];

  /**
   * The function to be executed
   */
  fn: Signature;
};

export type PluginAddedLinksConfigureFunc<Context extends object> = (context: Readonly<Context> | undefined) =>
  | Partial<{
      title: string;
      description: string;
      path: string;
      onClick: (event: React.MouseEvent | undefined, helpers: PluginExtensionEventHelpers<Context>) => void;
      icon: IconName;
      category: string;
    }>
  | undefined;

export type PluginExtensionAddedLinkConfig<Context extends object = object> = PluginExtensionConfigBase & {
  /**
   * The target extension points where the link will be added
   */
  targets: string | string[];

  /** A URL path that will be used as the href for the rendered link extension
   * (It is optional, because in some cases the action will be handled by the `onClick` handler instead of navigating to a new page)
   */
  path?: string;

  /** A URL path that will be used as the href for the rendered link extension
   * (It is optional, because in some cases the action will be handled by the `onClick` handler instead of navigating to a new page)
   * path?: string;
   *
   * A function that will be called when the link is clicked
   *  (It is called with the original event object)
   */
  onClick?: (event: React.MouseEvent | undefined, helpers: PluginExtensionEventHelpers<Context>) => void;

  // (Optional) A function that can be used to configure the extension dynamically based on the extension point's context
  configure?: PluginAddedLinksConfigureFunc<Context>;

  // (Optional) A icon that can be displayed in the ui for the extension option.
  icon?: IconName;

  // (Optional) A category to be used when grouping the options in the ui
  category?: string;
};

export type PluginExtensionExposedComponentConfig<Props = {}> = PluginExtensionConfigBase & {
  /**
   * The unique identifier of the component
   * Shoud be in the format of `<pluginId>/<componentName>/<componentVersion>`. e.g. `myorg-todo-app/todo-list/v1`
   */
  id: string;

  /**
   * The React component that will be exposed to other plugins
   */
  component: React.ComponentType<Props>;
};

export type PluginExtensionOpenModalOptions = {
  // The title of the modal
  title: string;
  // A React element that will be rendered inside the modal
  body: React.ElementType<{ onDismiss?: () => void }>;
  // Width of the modal in pixels or percentage
  width?: string | number;
  // Height of the modal in pixels or percentage
  height?: string | number;
};

export type PluginExtensionEventHelpers<Context extends object = object> = {
  context?: Readonly<Context>;
  // The ID of the extension point that triggered this event
  extensionPointId: string;
  // Opens a modal dialog and renders the provided React component inside it
  openModal: (options: PluginExtensionOpenModalOptions) => void;
  /**
   * @internal
   * Opens the extension sidebar with the registered component.
   * @param componentTitle The title of the component to be opened in the sidebar.
   * @param props The props to be passed to the component.
   */
  openSidebar: (componentTitle: string, props?: Record<string, unknown>) => void;
  /**
   * @internal
   * Closes the extension sidebar.
   */
  closeSidebar: () => void;
  /**
   * @internal
   * Toggles the extension sidebar with the registered component.
   * If the sidebar is open with the same component, it will be closed.
   * If the sidebar is closed or open with a different component, it will be opened with the specified component.
   * @param componentTitle The title of the component to be toggled in the sidebar.
   * @param props The props to be passed to the component.
   */
  toggleSidebar: (componentTitle: string, props?: Record<string, unknown>) => void;
};

// Extension Points & Contexts
// --------------------------------------------------------

// Extension Points available in core Grafana
export enum PluginExtensionPoints {
  AlertInstanceAction = 'grafana/alerting/instance/action',
  AlertingHomePage = 'grafana/alerting/home',
  AlertingAlertingRuleAction = 'grafana/alerting/alertingrule/action',
  AlertingRecordingRuleAction = 'grafana/alerting/recordingrule/action',
  AlertingRuleQueryEditor = 'grafana/alerting/alertingrule/queryeditor',
  CommandPalette = 'grafana/commandpalette/action',
  DashboardPanelMenu = 'grafana/dashboard/panel/menu',
  DashboardEmpty = 'grafana/dashboard/empty',
  DataSourceConfig = 'grafana/datasources/config',
  DataSourceConfigActions = 'grafana/datasources/config/actions',
  DataSourceConfigErrorStatus = 'grafana/datasources/config/error-status',
  DataSourceConfigStatus = 'grafana/datasources/config/status',
  ExploreToolbarAction = 'grafana/explore/toolbar/action',
  UserProfileTab = 'grafana/user/profile/tab',
  TraceViewDetails = 'grafana/traceview/details',
  TraceViewHeaderActions = 'grafana/traceview/header/actions',
  QueryEditorRowAdaptiveTelemetryV1 = 'grafana/query-editor-row/adaptivetelemetry/v1',
  TraceViewResourceAttributes = 'grafana/traceview/resource-attributes',
  LogsViewResourceAttributes = 'grafana/logsview/resource-attributes',
  AppChrome = 'grafana/app/chrome/v1',
  ExtensionSidebar = 'grafana/extension-sidebar/v0-alpha',
}

// Don't use directly in a plugin!
// Extension point IDs that contain dynamic segments and are not valid as static values — they require runtime substitution of certain parts.
// (They cannot be used as is. E.g. "grafana/nav-landing-page/.*/v1" becomes "grafana/nav-landing-page/observability/v1" during runtime.)
//
// IMPORTANT: NavLandingPage and NavLandingPageCards are mutually exclusive.
// If a plugin extends NavLandingPage, it will replace the entire page content and any NavLandingPageCards extensions will be ignored.
// Only use NavLandingPageCards if you want to add additional cards to the default landing page layout.
export enum PluginExtensionPointPatterns {
  NavLandingPage = 'grafana/dynamic/nav-landing-page/nav-id-.*/v1',
  NavLandingPageCards = 'grafana/dynamic/nav-landing-page/nav-id-.*/cards/v1',
}

// Extension Points available in plugins
export enum PluginExtensionExposedComponents {
  CentralAlertHistorySceneV1 = 'grafana/central-alert-history-scene/v1',
  AddToDashboardFormV1 = 'grafana/add-to-dashboard-form/v1',
}

export type PluginExtensionPanelContext = {
  pluginId: string;
  id: number;
  title: string;
  timeRange: RawTimeRange;
  timeZone: TimeZone;
  dashboard: Dashboard;
  targets: DataQuery[];
  scopedVars?: ScopedVars;
  data?: PanelData;
};

export type CentralAlertHistorySceneV1Props = {
  defaultLabelsFilter?: string;
  defaultTimeRange?: { from: string; to: string };
  hideFilters?: boolean;
  hideAlertRuleColumn?: boolean;
};

export type PluginExtensionQueryEditorRowAdaptiveTelemetryV1Context = {
  /** An ordered list of lower-case [a-z]+ string identifiers to provide context clues of where this component is being embedded and how we might want to consider displaying it */
  contextHints?: string[];
  query?: DataQuery & { expr?: string };
};

export type PluginExtensionDataSourceConfigContext<
  JsonData extends DataSourceJsonData = DataSourceJsonData,
  SecureJsonData = {},
> = {
  // The current datasource settings
  dataSource: DataSourceSettings<JsonData>;

  // Meta information about the datasource plugin
  dataSourceMeta: DataSourcePluginMeta;

  // Testing status
  testingStatus?: {
    message?: string | null;
    status?: string | null;
  };

  // Can be used to update the `jsonData` field on the datasource
  // (Only updates the form, it still needs to be saved by the user)
  setJsonData: (jsonData: JsonData) => void;
  setSecureJsonData: (secureJsonData: SecureJsonData) => void;
};

export type PluginExtensionCommandPaletteContext = {
  /** The current search query entered by the user */
  searchQuery?: string;
  /** Signal for request cancellation */
  signal?: AbortSignal;
};

/**
 * Context for dynamic command palette search providers.
 * Unlike the base context, searchQuery and signal are always provided.
 */
export type DynamicPluginExtensionCommandPaletteContext = {
  /** The current search query entered by the user */
  searchQuery: string;
  /** Signal for request cancellation */
  signal: AbortSignal;
  /** Currently active facet filters (facetId → selected valueId). Empty when no facets applied. */
  activeFacets?: Record<string, string>;
};

export type PluginExtensionResourceAttributesContext = {
  // Key-value pairs of resource attributes, attribute name is the key
  attributes: Record<string, string[]>;
  spanAttributes?: Record<string, string[]>;
  timeRange: AbsoluteTimeRange;
  datasource: {
    type: string;
    uid: string;
  };
};

export type DataSourceConfigErrorStatusContext = {
  dataSource: {
    type: string;
    uid: string;
    name: string;
  };
  testingStatus: {
    message?: string | null;
    status?: string | null;
    details?: Record<string, unknown>;
  };
};

export type PluginExtensionDataSourceConfigActionsContext = {
  dataSource: {
    type: string;
    uid: string;
    name: string;
    typeName: string;
  };
};

export type PluginExtensionDataSourceConfigStatusContext = {
  dataSource: {
    type: string;
    uid: string;
    name: string;
    typeName: string;
  };
  testingStatus?: {
    message?: string | null;
    status?: string | null;
    details?: Record<string, unknown>;
  };
  severity: 'success' | 'error' | 'warning' | 'info';
};

type Dashboard = {
  uid: string;
  title: string;
  tags: string[];
};

// Dynamic Command Palette Types
// --------------------------------------------------------

/**
 * A child action for multi-level command palette drill-down.
 * Shown when the user selects a parent result that has children.
 */
export type CommandPaletteDynamicResultChild = {
  /** Unique identifier for this child (scoped to parent) */
  id: string;
  /** Display title */
  title: string;
  /** Optional subtitle or description */
  description?: string;
  /** Optional icon (React element) displayed to the left of the title */
  icon?: React.ReactNode;
  /** Optional keywords for search matching within the sub-menu */
  keywords?: string[];
  /**
   * Action handler when this child is selected.
   * If not provided, will use `path` for navigation.
   */
  onSelect?: CommandPaletteDynamicResultAction;
  /** Optional URL to navigate to (alternative to onSelect) */
  path?: string;
};

/**
 * A single dynamic result item returned by a command palette search provider
 */
export type CommandPaletteDynamicResult = {
  /** Unique identifier for this result (scoped to plugin) */
  id: string;
  /** Display title */
  title: string;
  /** Optional subtitle or description */
  description?: string;
  /** Optional URL to navigate to (alternative to onSelect) */
  path?: string;
  /** Optional keywords for better search matching */
  keywords?: string[];
  /** Optional section/category override (defaults to plugin category) */
  section?: string;
  /** Optional custom data to pass through to the action handler */
  data?: Record<string, unknown>;
  /**
   * Action handler when this result is selected.
   * If not provided, will use `path` for navigation.
   * Ignored when `children` is provided.
   */
  onSelect?: CommandPaletteDynamicResultAction;
  /** Optional icon (React element) displayed to the left of the title */
  icon?: React.ReactNode;
  /** Optional React element rendered on the right side for secondary actions (e.g. buttons) */
  secondaryActions?: React.ReactNode;
  /**
   * Optional child actions for multi-level drill-down.
   * When provided, selecting this result drills into the children
   * instead of executing `onSelect` or navigating to `path`.
   */
  children?: CommandPaletteDynamicResultChild[];
  /** Optional detail panel rendered beside the results list when this item is active */
  detailPanel?: React.ReactNode;
};

/**
 * Action handler for when a dynamic result is selected
 */
export type CommandPaletteDynamicResultAction = (
  result: Omit<CommandPaletteDynamicResult, 'onSelect'>,
  helpers: PluginExtensionEventHelpers<DynamicPluginExtensionCommandPaletteContext>
) => void | Promise<void>;

/**
 * Search provider function that fetches dynamic results
 */
export type CommandPaletteDynamicSearchProvider = (
  context: DynamicPluginExtensionCommandPaletteContext
) => Promise<CommandPaletteDynamicResult[]>;

// Faceted Search Types
// --------------------------------------------------------

/**
 * Context passed to facet value providers.
 */
export interface CommandPaletteFacetContext {
  /** The current search query */
  searchQuery: string;
  /** Currently active facet selections (facetId → selected valueId) */
  activeFacets: Record<string, string>;
  /** Signal for request cancellation */
  signal: AbortSignal;
}

/**
 * A single selectable value within a facet.
 */
export interface CommandPaletteFacetValue {
  /** Unique identifier for this value */
  id: string;
  /** Display label */
  label: string;
  /** Optional count of matching results */
  count?: number;
  /** Optional icon displayed to the left of the label */
  icon?: React.ReactNode;
}

/**
 * A facet definition for progressive narrowing in command palette results.
 * Facets allow users to filter results by specific dimensions (e.g. type, region).
 */
export interface CommandPaletteDynamicFacet {
  /** Unique identifier for this facet */
  id: string;
  /** Display label (e.g. "Type", "Region") */
  label: string;
  /** Keyboard shortcut number ('1'-'9'). Displayed as Cmd+1, Cmd+2, etc. */
  shortcutKey?: string;
  /** Placeholder text for the search input when this facet is active */
  placeholder?: string;
  /**
   * Provider function that returns available values for this facet.
   * Receives the current active facets so values can be contextually filtered.
   */
  getValues: (context: CommandPaletteFacetContext) => Promise<CommandPaletteFacetValue[]>;
}

// Context-Aware Command Palette Action Types
// --------------------------------------------------------

/**
 * Page context passed to isAvailable/perform callbacks for context-aware actions.
 */
export interface CommandPalettePageContext {
  pathname: string;
  search: string;
}

/**
 * A single option shown in a context action step dropdown.
 */
export interface ContextStepOption {
  id: string;
  label: string;
  icon?: React.ReactNode;
  description?: string;
  /** Group header for visual grouping (e.g., "Quick ranges" vs "Time controls") */
  group?: string;
}

/**
 * A breadcrumb entry tracking selections across steps.
 */
export interface ContextStepBreadcrumb {
  label: string;
  value: string;
}

/**
 * Transition returned by onSelect to control what happens after a selection.
 */
export type ContextStepTransition =
  | { type: 'next'; step: CommandPaletteContextStep; breadcrumb: ContextStepBreadcrumb }
  | { type: 'apply'; close?: boolean }
  | { type: 'callback'; fn: () => void; close?: boolean }
  | { type: 'goBack'; breadcrumb?: ContextStepBreadcrumb };

/**
 * A step in a multi-level context action flow.
 * Each step defines a pill label, placeholder, options, and selection handler.
 */
export interface CommandPaletteContextStep {
  pillLabel: string;
  pillIcon?: string;
  placeholder: string;
  multiSelect?: boolean;
  /** Controls when selections take effect. 'eager' (default) applies immediately; 'deferred' batches until Cmd+Enter. */
  applyMode?: 'eager' | 'deferred';
  getOptions: (
    query: string,
    signal: AbortSignal,
    breadcrumbs: ContextStepBreadcrumb[]
  ) => Promise<ContextStepOption[]>;
  onSelect: (option: ContextStepOption, breadcrumbs: ContextStepBreadcrumb[]) => ContextStepTransition;
  onApply?: (selected: ContextStepOption[], breadcrumbs: ContextStepBreadcrumb[]) => void;
  /** Called on Cmd+Enter when applyMode is 'deferred'. Receives all accumulated breadcrumbs so the plugin can batch-apply. */
  onCommit?: (breadcrumbs: ContextStepBreadcrumb[]) => void;
  /** Called when a breadcrumb is removed via Backspace. Allows the plugin to un-apply the filter in eager mode. */
  onRemoveBreadcrumb?: (breadcrumb: ContextStepBreadcrumb) => void;
  /**
   * When going back from this step (via Escape with multi-select), collapse this many
   * additional history entries. Default 0 (go back one level).
   * Useful for N-level flows (e.g. label -> operator -> values) where Escape from the
   * deepest step should return to the root instead of the intermediate step.
   */
  collapseSteps?: number;
  /**
   * Custom breadcrumb builder when collapsing multiple steps.
   * Receives the breadcrumbs accumulated across the collapsed levels and the
   * comma-separated summary of selected values.
   * If not provided, breadcrumbs are joined by their labels.
   */
  buildCollapsedBreadcrumb?: (breadcrumbs: ContextStepBreadcrumb[], summary: string) => ContextStepBreadcrumb;
  /**
   * Optional static help panel displayed to the right of the options list.
   * Useful for showing syntax hints, examples, or contextual guidance.
   */
  helpPanel?: ContextStepHelpPanel;
}

/**
 * Static help content rendered as a right sidebar alongside the options list.
 */
export interface ContextStepHelpPanel {
  sections: ContextStepHelpSection[];
}

/**
 * A section within the help panel (e.g., "Common regex patterns", "Examples").
 */
export interface ContextStepHelpSection {
  title: string;
  items: ContextStepHelpItem[];
}

/**
 * A single item in a help section.
 */
export interface ContextStepHelpItem {
  /** Symbol or code snippet (displayed in a code-style badge) */
  symbol: string;
  /** Optional description text next to the symbol */
  description?: string;
}

/**
 * Configuration for a context-aware command palette action.
 * Context actions appear conditionally based on the current page.
 */
export interface CommandPaletteContextActionConfig {
  id: string;
  title: string;
  icon?: string;
  /** Section in the results list. Defaults to 'Pages'. */
  section?: string;
  /** Determines if this action is available on the current page. */
  isAvailable: (context: CommandPalettePageContext) => boolean;
  /** Simple action with no drill-down (e.g., "Clear filters"). */
  perform?: (context: CommandPalettePageContext) => void;
  /** Step-based drill-down (e.g., "Select time range", "Add filter"). */
  steps?: CommandPaletteContextStep;
}

/**
 * Configuration for registering a dynamic command palette provider
 */
export type PluginExtensionCommandPaletteDynamicConfig = {
  /**
   * Category/section name for grouping results.
   * If not provided, results will be grouped under "Dynamic Results".
   */
  category?: string;

  /**
   * Minimum query length before search is triggered
   * @default 2
   */
  minQueryLength?: number;

  /**
   * Search provider function that returns results.
   * Return an empty array to skip results for the current search.
   */
  searchProvider: CommandPaletteDynamicSearchProvider;

  /**
   * Optional facets for progressive narrowing of results.
   * When provided, the command palette renders facet pills and supports
   * keyboard-shortcut-driven filtering.
   */
  facets?: CommandPaletteDynamicFacet[];
};
