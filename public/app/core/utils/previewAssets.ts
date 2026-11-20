/**
 * Returns the preview build folder name (e.g. `pr_grafana_123456`) when this
 * session is serving frontend assets from a PR preview build, or undefined
 * when the release assets are in use.
 *
 * The value is injected into index.html by the frontend service when the
 * preview assets cookie is set - see pkg/services/frontend/preview_assets.go.
 */
export function getPreviewAssetsFolder(): string | undefined {
  return window.__grafanaPreviewAssets || undefined;
}
