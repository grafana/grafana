import { createContext, useContext } from 'react';

import {
  type AnnotationEventUIModel,
  type CoreApp,
  type DashboardCursorSync,
  type DataFrame,
  type DataLinkPostProcessor,
  type EventBus,
  EventBusSrv,
} from '@grafana/data';

import { type AdHocFilterItem } from '../Table/types';

import { type OnSelectRangeCallback, type SeriesVisibilityChangeMode } from './types';

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
