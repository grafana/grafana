import { PanelModel as BaseCorePanelModel } from '@grafana/data';
import { GridPos } from '@grafana/schema';

// Middle types to glue Public Plugin APIs types with internal Grafana types
export interface CorePanelModel extends BaseCorePanelModel {
  gridPos: GridPos;
  refresh: () => void;
}

export interface CoreDashboardModel {
  panels: CorePanelModel[];
  uid: string;
  title: string;
  updatePanels: (panels: CorePanelModel[]) => unknown;
}

export interface CoreDashboardSrv {
  dashboard?: CoreDashboardModel;
}

// Public types

/**
 * Used to interact with the current Grafana dashboard.
 *
 * @public
 */
export interface PluginsAPIDashboardSrv {
  /**
   * The current dashboard. Undefined if not dashboard is loaded
   * @deprecated use `getCurrentDashboard()` instead
   */
  dashboard?: PluginsAPIDashboardModel;
  /**
   * The current dashboard. Undefined if not dashboard is loaded
   */
  getCurrentDashboard(): PluginsAPIDashboardModel | undefined;
}

/**
 * Used to interact with the current Grafana dashboard.
 * @public
 */
export interface PluginsAPIDashboardModel {
  /**
   * The uid of the dashboard
   * @remarks
   * The ID attribute is deprecated and therefore not included in the public API.
   * @readonly
   */
  uid: string;
  /**
   * The title of the dashboard
   * @readonly
   */
  title: string;
  /**
   * @readonly
   * @deprecated use `getPanels()`
   */
  panels: PluginsAPIPanelModel[];

  /**
   * The panels of the dashboard
   * Get the panels in the current dashboard
   *
   * Changes to the panels are not instantly reflected in the dashboard
   * and are not persisted.
   *
   * The user is responsible for saving the dashboard after any changes
   */
  getPanels(): PluginsAPIPanelModel[];

  /**
   * Update the panels in the current dashboard by replacing them with
   * the ones passed in.
   *
   * Use `dashboard.panels` to get the current panels.
   *
   * Changes to the panels are reflected in the dashboard instantly
   * but not persisted.
   *
   * The user is responsible for saving the dashboard after any changes
   *
   * @public
   */
  updatePanels(panels: PluginsAPIPanelModel[]): void;
}

/**
 * A panel in a grafana dashboard.
 * @public
 */
export interface PluginsAPIPanelModel extends Pick<CorePanelModel, 'id' | 'title' | 'type' | 'options'> {
  /**
   *  The panel's grid position is defined by its x and y coordinates, as well as its width (w) and height (h).
   * Static panels remain unaffected by other panels' positioning changes.
   */
  gridPos: GridPos;
  /**
   * Forces the panel to re-render in the dashboard
   * fetching new data.
   * Use it to see changes to the panel properties
   *
   * Changes to the panel are reflected in the dashboard instantly but not persisted.
   *
   * The user is responsible for saving the dashboard after any changes
   */
  refresh(): void;
}
