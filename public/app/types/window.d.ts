import type { BootData } from '@grafana/data/types';
export declare global {
  interface Window {
    __grafanaSceneContext: SceneObject;
    __grafana_app_bundle_loaded: boolean;
    __grafana_public_path__: string;
    __grafana_load_failed: (err: unknown) => void;
    grafanaBootData: BootData;
    __grafanaPublicDashboardAccessToken?: string;

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
  }

  // Augment DOMParser to accept TrustedType sanitised content
  interface DOMParser {
    parseFromString(string: string | TrustedType, type: DOMParserSupportedType): Document;
  }
}
