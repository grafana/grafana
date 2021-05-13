import { EventBusSrv, EventBus, DashboardCursorSync, TimeZone, DefaultTimeZone, getTimeZone } from '@grafana/data';
import React from 'react';
import { SeriesVisibilityChangeMode } from '.';

/** @alpha */
export interface PanelContext {
  eventBus: EventBus;

  /** Dashboard panels sync */
  sync?: DashboardCursorSync;

  /** The dashboard/panel timezone */
  timeZone: TimeZone;

  /**
   * Called when a component wants to change the color for a series
   *
   * @alpha -- experimental
   */
  onSeriesColorChange?: (label: string, color: string) => void;

  /**
   * Called when a series should be toggled
   *
   * @alpha -- experimental
   */
  onToggleSeriesVisibility?: (label: string, mode: SeriesVisibilityChangeMode) => void;
}

export const PanelContextRoot = React.createContext<PanelContext>({
  eventBus: new EventBusSrv(),
  timeZone: getTimeZone(),
});

/**
 * @alpha
 */
export const PanelContextProvider = PanelContextRoot.Provider;

/**
 * @alpha
 */
export const usePanelContext = () => React.useContext(PanelContextRoot);
