import { t } from '@grafana/i18n';
import { type DashboardLink } from '@grafana/schema';

/**
 * Find and remove existing source links from the links array.
 *
 * Older Grafana versions injected a "View source file in repository" link into the dashboard JSON
 * at load time, which then leaked into saves and got committed to Git. The link is no longer
 * injected (the managed badge exposes the source file instead), but repo-managed dashboards may
 * still carry the stale link in their JSON — this strips it at load so it disappears from the UI
 * and from the next save.
 *
 * A source link is identified by its tooltip matching the source link tooltip translation.
 */
export function removeExistingSourceLinks(links: DashboardLink[] | undefined): DashboardLink[] {
  if (!links) {
    return [];
  }
  const sourceLinkTooltip = t('dashboard.source-link.tooltip', 'View source file in repository');
  return links.filter((link) => link.tooltip !== sourceLinkTooltip);
}
