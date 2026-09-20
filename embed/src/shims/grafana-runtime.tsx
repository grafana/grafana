import { createTheme, type GrafanaTheme2 } from '@grafana/data';

/**
 * Shim for @grafana/runtime, whose real config module reads window.grafanaBootData
 * at import time and throws outside the app. Exports are deliberately minimal so a
 * new runtime dependency entering the graph fails the build loudly rather than
 * silently no-oping.
 */
let currentTheme: GrafanaTheme2 = createTheme();

/**
 * Theme in use by each mounted panel, so a conflict can be reported.
 *
 * Every element builds its own theme object, so identity is useless here: two
 * panels that agree would look like a conflict. Compare the parts that actually
 * decide how a panel renders instead.
 */
const themesByOwner = new Map<object, string>();
let warnedThemeConflict = false;

function themeSignature(theme: GrafanaTheme2): string {
  return [
    theme.colors.mode,
    theme.colors.background.canvas,
    theme.colors.text.primary,
    theme.typography.fontFamily,
  ].join('|');
}

/**
 * Set immediately before a panel renders, so panel code reading config.theme2 agrees
 * with that panel's theme.
 *
 * config.theme2 is a module global, which is fine for one panel and a hazard for
 * several: the last panel to render wins, and any other panel's code that reads it
 * rather than the React theme context resolves the wrong colours. That cannot be
 * fixed without threading a theme through grafana-ui's config reads, so rather than
 * failing silently it warns once. Panels on one page should share a theme.
 *
 * `owner` identifies the mounting panel; pass the same value to clearRuntimeTheme
 * when it unmounts.
 */
export function setRuntimeTheme(theme: GrafanaTheme2, owner?: object) {
  currentTheme = theme;

  if (!owner || warnedThemeConflict) {
    return;
  }
  themesByOwner.set(owner, themeSignature(theme));
  if (new Set(themesByOwner.values()).size > 1) {
    warnedThemeConflict = true;
    console.warn(
      '[grafana-embed] panels on this page are using different themes. config.theme2 is ' +
        'a module global, so panel code that reads it may resolve the wrong theme. ' +
        'Give panels on one page the same theme.'
    );
  }
}

/** Call when a panel unmounts so a stale theme cannot trigger a false conflict. */
export function clearRuntimeTheme(owner: object) {
  themesByOwner.delete(owner);
}

interface EmbedRuntimeConfig {
  readonly theme2: GrafanaTheme2;
  featureToggles: Record<string, boolean | undefined>;
  buildInfo: { version: string };
  panels: Record<string, unknown>;
}

export const config: EmbedRuntimeConfig = {
  get theme2() {
    return currentTheme;
  },
  featureToggles: {},
  buildInfo: { version: '0.0.0' },
  panels: {},
};

/**
 * Display-only stand-in for the real PanelDataErrorView, which pulls app-core data
 * services. Panels use it purely to show "no data" messaging.
 */
export function PanelDataErrorView({ message }: { message?: string; [key: string]: unknown }) {
  return <div style={{ padding: 8, opacity: 0.7, fontSize: 12 }}>{message ?? 'No data'}</div>;
}

/** An embedded panel has no datasource service; datasource-resolved links degrade to none. */
export function getDataSourceSrv() {
  return {
    getInstanceSettings: () => undefined,
    get: () => Promise.reject(new Error('@grafana/embed: no datasource service in an embedded panel')),
  };
}

/** Template interpolation is a dashboard concern; the host owns variable substitution. */
export function getTemplateSrv() {
  return { replace: (value?: string) => value ?? '', getVariables: () => [] };
}

/**
 * Re-exported from the package's own source rather than reimplemented.
 *
 * queryResponse.ts is free of runtime coupling: it imports values only from
 * @grafana/data, and everything it takes from ../services and
 * ./DataSourceWithBackend is type-only. It is not reachable here through
 * '@grafana/runtime' because the package exposes no subpath for it and this shim
 * replaces the barrel, so the embed reaches it by path.
 */
export {
  toDataQueryResponse,
  type BackendDataSourceResponse,
} from '../../../packages/grafana-runtime/src/utils/queryResponse';
