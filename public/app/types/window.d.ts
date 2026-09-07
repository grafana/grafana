import { type BootData } from '@grafana/data';
export declare global {
  interface Window {
    __grafanaSceneContext: SceneObject;
    __grafana_app_bundle_loaded: boolean;
    /** Path to the public folder, without the build directory. */
    __grafana_public_path__: string;

    /**
     * URL prefix the active bundler compiled its asset references against, including the
     * build directory: 'public/build/' under webpack, 'public/build/rspack/' under rspack,
     * prefixed with the CDN origin when one is configured. Use it for assets the bundler
     * emits or copies into that directory (icons, maps, gazetteers).
     */
    __grafana_build_path__: string;
    __grafana_load_failed: (err: unknown) => void;
    grafanaBootData: BootData;
    __grafanaPublicDashboardAccessToken?: string;

    /**
     * Controls legacy `/api/` requests are handled in the frontend, for development.
     * - `off`: requests are left untouched
     * - `log`: requests are allowed but logged with a warning
     * - `block`: requests are rejected before they are sent
     */
    __grafanaLegacyAPIMode?: string;

    /**
     * (Potential) wait for API call to fetch boot data and place it on `window.grafanaBootData`.
     * Required in new index.html to fetch necessary data before app init()
     **/
    __grafana_boot_data_promise: Promise<void>;

    public_cdn_path: string;
    nonce: string | undefined;
    System: typeof System;

    /**
     * Chromedp binding injected by grafana-image-renderer for report rendering communication.
     * Takes a JSON-stringified message and signals render completion.
     */
    __grafanaImageRendererMessageChannel?: (message: string) => void;

    /**
     * Set by Grafana to indicate support for the render binding protocol.
     * The image renderer can check this to decide whether to use this mechanism or a fallback.
     */
    __grafanaRenderBindingSupported?: boolean;

    /**
     * Controls whether the frontend OFREP client uses the root `/ofrep/v1` route
     * instead of the namespaced route. Evaluated server-side since OpenFeature
     * isn't set up yet when the OFREP provider's baseUrl is constructed.
     */
    __grafanaOFREPRootUrlEnabled?: boolean;

    /** Selects the Luxon-backed implementation before the application bundle loads. */
    __grafanaUseLuxon?: boolean;

    /**
     * Set by the frontend service to the preview folder name when this page is
     * serving frontend assets from a PR preview build instead of the release assets.
     */
    __grafanaPreviewAssets?: string;
  }

  // Augment DOMParser to accept TrustedType sanitised content
  interface DOMParser {
    parseFromString(string: string | TrustedType, type: DOMParserSupportedType): Document;
  }
}
