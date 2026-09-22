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
} from '@grafana/data';
import { type VizPanelRuntimeTransformations } from '@grafana/scenes';

import { type AdHocFilterItem } from '../Table/types';

import { type OnSelectRangeCallback, type SeriesVisibilityChangeMode } from './types';

/** Reactive view of one owner's runtime transformation stage. @alpha */
export interface AdHocTransformationsState {
  /** Transformations currently applied after the panel's saved transformations. */
  transformations: readonly DataTransformerConfig[];

  /** Raw frames entering the ad-hoc stage, including fields removed by its transformations. */
  sourceSeries: readonly DataFrame[];

  /** Replaces the ad-hoc stage. Pass `[]` to clear it. */
  setTransformations(transformations: readonly DataTransformerConfig[]): void;
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
  adHocTransformations?: VizPanelRuntimeTransformations;
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
