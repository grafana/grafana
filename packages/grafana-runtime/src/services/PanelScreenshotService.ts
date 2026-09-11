/**
 * Options for the panel screenshot service.
 *
 * @alpha
 */
export interface PanelScreenshotOptions {
  /**
   * Output image format. Defaults to `'png'`.
   */
  format?: 'png' | 'jpeg' | 'webp';

  /**
   * Scene root used to resolve `panelPathId` to a `pluginId` for plugin
   * overrides via `PanelPlugin.onScreenshot`. Pass `this` from a `SceneObject`,
   * a scene reference held by your component, or omit to fall back to the
   * global `window.__grafanaSceneContext`.
   *
   * Typed as `unknown` so `@grafana/runtime` does not depend on
   * `@grafana/scenes`; scene-aware callers should pass a concrete `SceneObject`
   * (the implementation duck-types it). A scenes-side typed wrapper can be
   * layered on top without changing this surface.
   *
   * If the scene context cannot be resolved to a `pluginId`, capture falls
   * through to the default html-to-image renderer.
   *
   * @alpha
   */
  sceneContext?: unknown;
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
   * Capture the panel identified by `panelPathId`.
   *
   * Obtain `panelPathId` from `PluginExtensionPanelContext.panelPathId` when
   * consuming this service from a panel-menu extension. The value is opaque -
   * pass it through unchanged. Unique per rendered panel instance, including
   * across repeated panels.
   *
   * Override hooks registered via `PanelPlugin.setScreenshotImage()` are only
   * consulted in scenes-based dashboards. In legacy dashboards, capture()
   * always uses the default html-to-image path.
   *
   * @param panelPathId opaque panel identifier (see `PluginExtensionPanelContext.panelPathId`)
   * @param options output format options
   * @returns a Blob containing the rendered image bytes
   * @throws if the panel is not currently visible, or if the capture fails
   */
  capture(panelPathId: string, options?: PanelScreenshotOptions): Promise<Blob>;
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
