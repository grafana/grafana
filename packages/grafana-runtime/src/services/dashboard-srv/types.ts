import { PanelModel } from '@grafana/data';
import { GridPos } from '@grafana/schema';

/**
 * Used to interact with the current Grafana dashboard.
 *
 * @public
 */
export class PublicDashboardSrv {
  /**
   * The current dashboard. Undefined if not dashboard is loaded
   */
  dashboard?: PublicDashboardModel;
}

/**
 * Used to interact with the current Grafana dashboard.
 * @public
 */
export interface PublicDashboardModel {
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
   * The panels of the dashboard
   *  Making changes to this attribute, such as adding or removing items, will directly impact the panels displayed in the dashboard.
   */
  panels: PublicPanelModel[];
}

/**
 * A panel in a grafana dashboard.
 * @public
 */
export interface PublicPanelModel extends Pick<PanelModel, 'id' | 'title' | 'type'> {
  /**
   *  The panel's grid position is defined by its x and y coordinates, as well as its width (w) and height (h).
   * Static panels remain unaffected by other panels' positioning changes.
   */
  gridPos: GridPos;
}
