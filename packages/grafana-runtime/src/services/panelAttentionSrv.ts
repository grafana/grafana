export type PanelWithAttention = number | string | null;

export interface PanelAttentionSrv {
  /**
   *
   * @param panelId - the element close to where the panelId lives, or the viz-panel-key string for scenes.
   */
  setPanelWithAttention(panelId: PanelWithAttention): void;
  getPanelWithAttention(): PanelWithAttention;
}

let singletonInstance: PanelAttentionSrv;

/**
 * Used during startup by Grafana to set the PanelAttentionService so it is available
 * via the {@link getPanelAttentionSrv} to the rest of the application.
 *
 * @internal
 */
export function setPanelAttentionSrv(instance: PanelAttentionSrv) {
  singletonInstance = instance;
}

/**
 * Used to retrieve a service that manages panel attention, mainly used for keyboard shortcuts
 *
 * @public
 */
export function getPanelAttentionSrv(): PanelAttentionSrv {
  return singletonInstance;
}
