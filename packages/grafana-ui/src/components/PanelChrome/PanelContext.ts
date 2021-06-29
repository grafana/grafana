import { EventBusSrv, EventBus, DashboardCursorSync, AnnotationEventUIModel } from '@grafana/data';
import React from 'react';
import { SeriesVisibilityChangeMode } from '.';

/** @alpha */
export interface PanelContext {
  eventBus: EventBus;

  /** Dashboard panels sync */
  sync?: DashboardCursorSync;

  /**
   * Called when a component wants to change the color for a series
   *
   * @alpha -- experimental
   */
  onSeriesColorChange?: (label: string, color: string) => void;

  onToggleSeriesVisibility?: (label: string, mode: SeriesVisibilityChangeMode) => void;

  canAddAnnotations: () => boolean;
  createAnnotation?: (annotation: AnnotationEventUIModel) => void;
  updateAnnotation?: (annotation: AnnotationEventUIModel) => void;
  deleteAnnotation?: (id: number) => void;
}

export const PanelContextRoot = React.createContext<PanelContext>({
  eventBus: new EventBusSrv(),
  canAddAnnotations: () => false,
});

/**
 * @alpha
 */
export const PanelContextProvider = PanelContextRoot.Provider;

/**
 * @alpha
 */
export const usePanelContext = () => React.useContext(PanelContextRoot);
