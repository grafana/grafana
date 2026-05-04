/**
 * Image format options for the panel screenshot service.
 *
 * @alpha
 */
export interface PanelScreenshotOptions {
  /**
   * Output image format. Defaults to `'png'`.
   */
  format?: 'png' | 'jpeg' | 'webp';
}

/**
 * Captures a snapshot of a panel as the user currently sees it.
 *
 * The panel must currently be visible in the user's browser. Off-screen,
 * unmounted, or virtualised panels throw.
 *
 * Should be accessed via {@link getPanelScreenshotService}.
 *
 * @alpha
 */
export interface PanelScreenshotService {
  /**
   * Capture the panel identified by `panelKey`.
   *
   * Obtain `panelKey` from `PluginExtensionPanelContext.panelKey` when
   * consuming this service from a panel-menu extension. The value is opaque -
   * pass it through unchanged.
   *
   * Override hooks registered via `PanelPlugin.setScreenshotImage()` are only
   * consulted in scenes-based dashboards. In legacy dashboards, capture()
   * always uses the default html-to-image path.
   *
   * @param panelKey opaque panel identifier (see `PluginExtensionPanelContext.panelKey`)
   * @param options output format options
   * @returns a Blob containing the rendered image bytes
   * @throws if the panel is not currently visible, or if the capture fails
   */
  capture(panelKey: string, options?: PanelScreenshotOptions): Promise<Blob>;
}

let singletonInstance: PanelScreenshotService;

/**
 * Used during startup by Grafana to set the PanelScreenshotService so it is available
 * via {@link getPanelScreenshotService} to the rest of the application.
 *
 * @internal
 */
export function setPanelScreenshotService(instance: PanelScreenshotService) {
  singletonInstance = instance;
}

/**
 * Used to retrieve the {@link PanelScreenshotService}.
 *
 * @alpha
 */
export function getPanelScreenshotService(): PanelScreenshotService {
  return singletonInstance;
}
