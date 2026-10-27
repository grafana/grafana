import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';

/**
 * Whether the homepage runs on a multi-tenant stack that does not serve legacy `/api` endpoints. Sections whose
 * only backend is such an endpoint are hidden the same way a missing plugin hides them. Each gate is removed once
 * its endpoint has an `/apis` equivalent.
 *
 * For code outside the render loop (probes, fetchers). Components and hooks read
 * `useFlagGrafanaMultiTenantHomepage()` instead so they re-render when the flag changes.
 */
export function isMultiTenantHomepage(): boolean {
  return getFeatureFlagClient().getBooleanValue(FlagKeys.GrafanaMultiTenantHomepage, false);
}
