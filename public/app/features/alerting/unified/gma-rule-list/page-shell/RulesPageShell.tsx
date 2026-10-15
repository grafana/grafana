import { type ReactNode } from 'react';

import { t } from '@grafana/i18n';
import { Tab, TabsBar } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';

import { AlertingPageWrapper } from '../../components/AlertingPageWrapper';

export type RulesPageActiveTab = 'active' | 'deleted';

export interface RulesPageShellProps {
  navId: string;
  /** The page's own name (e.g. "Alert rules"), not a generic "Active". */
  pageLabel: string;
  activeTab: RulesPageActiveTab;
  activeHref: string;
  deletedHref: string;
  primaryAction?: ReactNode;
  children: ReactNode;
}

// The heading comes from the `Page` navId so it also drives breadcrumbs and nav highlighting.
// The Recently deleted tab needs the organization Admin role (not server admin), matching trash access.
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
