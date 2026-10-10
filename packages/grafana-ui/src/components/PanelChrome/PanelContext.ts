import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from 'react';

import {
  type AnnotationEventUIModel,
  type CoreApp,
  type DashboardCursorSync,
  type DataFrame,
  type DataLinkPostProcessor,
  type DataTransformerConfig,
  type EventBus,
  EventBusSrv,
  type PanelNotices,
} from '@grafana/data';

import { type AdHocFilterItem } from '../Table/types';

import { type OnSelectRangeCallback, type SeriesVisibilityChangeMode } from './types';

/** Runtime transformations supplied by a panel host, grouped by owner. @alpha */
export interface PanelRuntimeTransformations {
  /** Returns the same immutable snapshot until this owner changes. */
  get(owner: string): readonly DataTransformerConfig[];
  /** Replaces one owner's transformations. An empty list removes the owner. */
  set(owner: string, transformations: readonly DataTransformerConfig[]): void;
  /** Returns data before this owner's transformations. */
  getSourceSeries(owner: string): readonly DataFrame[];
  /** Subscribes to changes for one owner. Returns an unsubscribe function. */
  subscribe(owner: string, callback: () => void): () => void;
}

/** Reactive view of one owner's runtime transformations. @alpha */
export interface AdHocTransformationsState {
  /** Transformations currently applied after the panel's saved transformations. */
  transformations: readonly DataTransformerConfig[];

  /** Data before this owner's transformations, including columns they hide. */
  sourceSeries: readonly DataFrame[];

  /** Replaces this owner's transformations. Pass `[]` to clear them. */
  setTransformations(transformations: readonly DataTransformerConfig[]): void;
}

/** @alpha */
export interface PanelContext {
  /** Panel-owned notices. Absent on hosts without notice support. @alpha */
  notices?: PanelNotices;
  /** Investigates one current status item, addressed by its runtime ID. @alpha */
  onInvestigateStatusItem?: (id: string) => void;
  /** Connects host data for the lifetime of a panel status surface. @internal */
  activateNotices?: () => () => void;
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

  /**
   * Used by the panel header status popover to trigger an AI-assisted investigation of the
   * panel's query errors and notices.
   */
  onInvestigateErrors?: () => void;

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

  /** Present when the panel host supports ad-hoc transformations. @alpha */
  adHocTransformations?: PanelRuntimeTransformations;
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
 * Returns the selected owner's transformations and re-renders when the panel host changes them.
 * Returns `undefined` when the panel host does not support ad-hoc transformations.
 *
 * @alpha
 */
export function useAdHocTransformations(owner: string): AdHocTransformationsState | undefined {
  const api = usePanelContext().adHocTransformations;
  const subscribe = useCallback(
    (onChange: () => void) => (api ? api.subscribe(owner, onChange) : () => {}),
    [api, owner]
  );
  const getSnapshot = useCallback(() => api?.get(owner), [api, owner]);
  const transformations = useSyncExternalStore(subscribe, getSnapshot);
  const sourceSeries = api?.getSourceSeries(owner);
  const setTransformations = useCallback(
    (nextTransformations: readonly DataTransformerConfig[]) => api?.set(owner, nextTransformations),
    [api, owner]
  );

  return useMemo(
    () => (transformations && sourceSeries ? { transformations, sourceSeries, setTransformations } : undefined),
    [transformations, sourceSeries, setTransformations]
  );
}
