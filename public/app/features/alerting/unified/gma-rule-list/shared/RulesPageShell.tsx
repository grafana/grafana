import { type ReactNode } from 'react';

import { t } from '@grafana/i18n';
import { Tab, TabsBar } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';

import { AlertingPageWrapper } from '../../components/AlertingPageWrapper';

export type RulesPageActiveTab = 'active' | 'deleted';

export interface RulesPageShellProps {
  navId: string;
  /** Label for the first tab - the page's own name (e.g. "Alert rules"), not a generic
   * "Active" - so it reads the same as the second tab's "Recently deleted". */
  pageLabel: string;
  activeTab: RulesPageActiveTab;
  activeHref: string;
  deletedHref: string;
  primaryAction?: ReactNode;
  children: ReactNode;
}

/**
 * Shared shell for the Alert rules and Recording rules pages: page heading, primary action,
 * and the page-name/Recently-deleted tabs. Each rule type keeps its own Recently deleted page
 * rather than sharing a combined one, so this only renders the tab strip - it does not fetch
 * or compose the deleted-rules content itself.
 *
 * The heading comes from the standard `Page` navId lookup (matching the size/position of
 * every other alerting page's title) rather than a locally rendered string, so it also drives
 * breadcrumbs and main-nav highlighting.
 *
 * The Recently deleted tab matches the organization Admin role, not Grafana server admin, to
 * match the existing trash access boundary for these rules.
 */
export function RulesPageShell({
  navId,
  pageLabel,
  activeTab,
  activeHref,
  deletedHref,
  primaryAction,
  children,
}: RulesPageShellProps) {
  const canSeeDeletedTab = contextSrv.hasRole('Admin');

  return (
    <AlertingPageWrapper navId={navId} actions={primaryAction}>
      <TabsBar>
        <Tab label={pageLabel} active={activeTab === 'active'} href={activeHref} />
        {canSeeDeletedTab && (
          <Tab
            label={t('alerting.gma-rule-list.tab-recently-deleted', 'Recently deleted')}
            active={activeTab === 'deleted'}
            href={deletedHref}
          />
        )}
      </TabsBar>
      <div>{children}</div>
    </AlertingPageWrapper>
  );
}
