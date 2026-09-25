import { type ReactNode } from 'react';

import { t } from '@grafana/i18n';
import { Tab, TabsBar } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';

import { AlertingPageWrapper } from '../../components/AlertingPageWrapper';

export type RulesPageActiveTab = 'active' | 'deleted';

export interface RulesPageShellProps {
  navId: string;
  title: string;
  activeTab: RulesPageActiveTab;
  activeHref: string;
  deletedHref: string;
  primaryAction?: ReactNode;
  children: ReactNode;
}

/**
 * Shared shell for the Alert rules and Recording rules pages: title, primary action, and the
 * active/Recently deleted tabs. Each rule type keeps its own Recently deleted page rather than
 * sharing a combined one, so this only renders the tab strip - it does not fetch or compose the
 * deleted-rules content itself.
 *
 * The Recently deleted tab matches the organization Admin role, not Grafana server admin, to
 * match the existing trash access boundary for these rules.
 */
export function RulesPageShell({
  navId,
  title,
  activeTab,
  activeHref,
  deletedHref,
  primaryAction,
  children,
}: RulesPageShellProps) {
  const canSeeDeletedTab = contextSrv.hasRole('Admin');

  return (
    <AlertingPageWrapper navId={navId} renderTitle={() => title} actions={primaryAction}>
      <TabsBar>
        <Tab
          label={t('alerting.gma-rule-list.tab-active', 'Active')}
          active={activeTab === 'active'}
          href={activeHref}
        />
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
