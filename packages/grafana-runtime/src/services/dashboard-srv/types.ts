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
   * @deprecated use `getCurrentDashboard()` instead
   */
  dashboard?: PluginsAPIDashboardModel;
  /**
   * Represents the currently loaded dashboard. Returns 'undefined' if no dashboard is loaded.
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
   * Note: The old `id` attribute is deprecated and therefore not included in the public API.
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
   * Returns the panels within the current dashboard.
   *
   * Note: Modifications to the panels are not immediately visible on the dashboard and are not automatically saved.
   *
   * Users must manually save the dashboard to persist any changes.
   */
  getPanels(): PluginsAPIPanelModel[];

  /**
   * Replaces the existing panels on the current dashboard with the provided ones.
   *
   * To retrieve current panels, refer to `getPanels()`.
   *
   * Note: While panel changes are instantly reflected on the dashboard, they are not automatically saved.
   *
   * Users must manually save the dashboard to persist any modifications.
   *
   * @public
   */
  updatePanels(panels: PluginsAPIPanelModel[]): void;
}

/**
 * A panel in a grafana dashboard.
 * @public
 */
export interface PluginsAPIPanelModel extends Pick<CorePanelModel, 'options'> {
  /**
   * The panel's unique ID
   */
  id: number;
  /**
   * The panel's title
   */
  title?: string;
  /**
   * Represents the type of the panel, such as 'graph', 'table', and so on.
   * In case of panels provided by a plugin, this will contain the plugin's ID.
   */
  type: string;
  /**
   *  The panel's grid position is defined by its x and y coordinates, as well as its width (w) and height (h).
   * Static panels remain unaffected by other panels' positioning changes.
   */
  gridPos: GridPos;
  /**
   * Contains user-defined panel options, set via the panel editor.
   *
   * This also includes custom fields provided by any plugins.
   */
  options: CorePanelModel['options'];
  /**
   * Triggers a re-render of the panel on the dashboard, fetching fresh data.
   * Useful for visualizing immediate changes to panel properties.
   *
   * Note: While changes are instantly visible on the dashboard, they are not automatically saved.
   *
   * Users must manually save the dashboard to persist any modifications.
   */
  refresh(): void;
}
