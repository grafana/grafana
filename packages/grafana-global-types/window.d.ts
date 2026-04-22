interface Window {
  __grafanaSceneContext: unknown;
  __grafana_app_bundle_loaded: boolean;
  __grafana_public_path__: string;
  __grafana_load_failed: (err: unknown) => void;
  grafanaBootData: import('@grafana/data').BootData;
  __grafanaPublicDashboardAccessToken?: string;
  /** Wait for API call to fetch boot data before app init() */
  __grafana_boot_data_promise: Promise<void>;
  public_cdn_path: string;
  nonce: string | undefined;
  System: typeof System;
  /** Chromedp binding injected by grafana-image-renderer for render communication. */
  __grafanaImageRendererMessageChannel?: (message: string) => void;
  /** Indicates support for the render binding protocol. */
  __grafanaRenderBindingSupported?: boolean;
}

interface DOMParser {
  parseFromString(string: string | TrustedType, type: DOMParserSupportedType): Document;
}
