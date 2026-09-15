import { createContext, useCallback, useContext, useSyncExternalStore } from 'react';

import {
  type AnnotationEventUIModel,
  type CoreApp,
  type DashboardCursorSync,
  type DataFrame,
  type DataLinkPostProcessor,
  type DataTransformerConfig,
  type EventBus,
  EventBusSrv,
} from '@grafana/data';

import { type AdHocFilterItem } from '../Table/types';

import { type OnSelectRangeCallback, type SeriesVisibilityChangeMode } from './types';

/**
 * A per-viewer transformation stage that runs after the panel's configured transformations. It is
 * never persisted, never marks the dashboard dirty, and is available to users without edit rights.
 *
 * @alpha
 */
export interface AdHocTransformationsApi {
  /**
   * The stage as currently applied. The reference is stable until `set` is called, so it is safe as a
   * `useSyncExternalStore` snapshot and in a dependency array.
   */
  get(): readonly DataTransformerConfig[];

  /** Replaces the stage. Pass `[]` to clear it. Treat the configs as immutable: build new objects. */
  set(transformations: DataTransformerConfig[]): void;

  /**
   * The series as they entered this stage: after the panel's configured transformations and before
   * these. Use it to offer a field that an ad-hoc transformation has removed from `data`.
   *
   * These are raw frames — no field config or overrides applied — so read labels with
   * `getFieldDisplayName` rather than `field.state.displayName`.
   */
  getSourceSeries(): DataFrame[];

  /** Fires after `set`. Not for new query results, which re-render the panel anyway. */
  subscribe(callback: () => void): () => void;
}

/** @alpha */
export interface PanelContext {
  /** Identifier for the events scope */
  eventsScope: string;
  eventBus: EventBus;

  /** Dashboard panels sync */
  sync?: () => DashboardCursorSync;

  /** Information on what the outer container is */
  app?: CoreApp | 'string';

  /**
   * Called when a component wants to change the color for a series
   *
   * @alpha -- experimental
   */
  onSeriesColorChange?: (label: string, color: string) => void;

  onToggleSeriesVisibility?: (label: string | string[] | null, mode: SeriesVisibilityChangeMode) => void;

  canAddAnnotations?: () => boolean;
  canEditAnnotations?: (dashboardUID?: string) => boolean;
  canDeleteAnnotations?: (dashboardUID?: string) => boolean;
  canExecuteActions?: () => boolean;
  onAnnotationCreate?: (annotation: AnnotationEventUIModel) => void;
  onAnnotationUpdate?: (annotation: AnnotationEventUIModel) => void;
  onAnnotationDelete?: (id: string) => void;

  /**
   * Called when a user selects an area on the panel, if defined will override the default behavior of the panel,
   * which is to update the time range
   */
  onSelectRange?: OnSelectRangeCallback;

  /**
   * Used from visualizations like Table to add ad-hoc filters from cell values
   */
  onAddAdHocFilter?: (item: AdHocFilterItem) => void;

  /**
   * Returns filters based on existing grouping or an empty array
   */
  getFiltersBasedOnGrouping?: (items: AdHocFilterItem[]) => AdHocFilterItem[];
  /**
   *
   * Used to apply multiple filters at once
   */
  onAddAdHocFilters?: (items: AdHocFilterItem[]) => void;

  /**
   * Used by the panel header status popover to open the errors and notices view.
   */
  onOpenInspector?: () => void;

  /** For instance state that can be shared between panel & options UI  */
  instanceState?: any;

  /** Update instance state, this is only supported in dashboard panel context currently */
  onInstanceStateChange?: (state: any) => void;

  /**
   * Called when a panel is changing the sort order of the legends.
   */
  onToggleLegendSort?: (sortBy: string) => void;

  /**
   * Optional, only some contexts support this. This action can be cancelled by user which will result
   * in a the Promise resolving to a false value.
   */
  onUpdateData?: (frames: DataFrame[]) => Promise<boolean>;

  /**
   * Optional supplier for internal data links. If not provided a link pointing to Explore will be generated.
   * @internal
   * @deprecated Please use DataLinksContext instead. This property will be removed in next major.
   */
  dataLinkPostProcessor?: DataLinkPostProcessor;

  /**
   * Present only where the host supports ad-hoc transformations for this panel. Absent in Explore,
   * alerting previews, the panel inspector, and for panels with no transformation stage — so a panel
   * reading this must handle it being undefined.
   *
   * @alpha
   */
  adHocTransformations?: AdHocTransformationsApi;
}

export const PanelContextRoot = createContext<PanelContext>({
  eventsScope: 'global',
  eventBus: new EventBusSrv(),
});

/**
 * @alpha
 */
export const PanelContextProvider = PanelContextRoot.Provider;

/**
 * @alpha
 */
export const usePanelContext = () => useContext(PanelContextRoot);

/**
 * Subscribes to the panel's ad-hoc transformation stage, re-rendering when it changes. Returns
 * undefined where the host does not support it.
 *
 * The stage changing usually changes the data too, which would re-render on its own — but not
 * always (a config that happens to produce identical frames), and a panel whose UI is driven by the
 * configs rather than by the data needs to follow them either way.
 *
 * @alpha
 */
export function useAdHocTransformations(): AdHocTransformationsApi | undefined {
  const api = usePanelContext().adHocTransformations;

  useSyncExternalStore(
    useCallback((onChange) => (api ? api.subscribe(onChange) : () => {}), [api]),
    useCallback(() => api?.get(), [api])
  );

  return api;
}
