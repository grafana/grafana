import { t } from '@grafana/i18n';
import { Page } from 'app/core/components/Page/Page';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { RolesListTab } from './RolesListTab';

export default function RolesPage() {
  const hasAccess = contextSrv.hasPermission(AccessControlAction.ActionRolesList);

  if (!hasAccess) {
    return (
      <Page navId="admin-roles">
        <Page.Contents>
          <p>{t('admin.roles-page.no-permission', 'You do not have permission to view roles.')}</p>
        </Page.Contents>
      </Page>
    );
  }

  return (
    <Page navId="admin-roles">
      <RolesListTab />
    </Page>
  );
}
