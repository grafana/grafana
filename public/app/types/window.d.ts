export declare global {
  interface Window {
    __grafanaSceneContext: SceneObject;
    __grafana_app_bundle_loaded: boolean;
    __grafana_public_path__: string;
    __grafana_load_failed: () => void;
    grafanaBootData: import('@grafana/data').BootData;

    /**
     * (Potential) wait for API call to fetch boot data and place it on `window.grafanaBootData`.
     * Required in new index.html to fetch necessary data before app init()
     **/
    __grafana_boot_data_promise: Promise<void>;

    /**
     * Reloads a plugin without refreshing the browser.
     * @param options - Options object containing the plugin ID
     * @param options.id - The ID of the plugin to reload
     * @returns Promise that resolves when the plugin has been reloaded
     * @example
     * ```typescript
     * await window.reloadPlugin({ id: 'grafana-synthetic-monitoring-app' });
     * ```
     */
    reloadPlugin: (options: { id: string }) => Promise<void>;

    public_cdn_path: string;
    nonce: string | undefined;
    System: typeof System;
  }

  // Augment DOMParser to accept TrustedType sanitised content
  interface DOMParser {
    parseFromString(string: string | TrustedType, type: DOMParserSupportedType): Document;
  }
}
