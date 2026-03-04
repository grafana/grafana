import { useMemo } from 'react';
import { useParams } from 'react-router-dom-v5-compat';

import { NavModelItem } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Page } from 'app/core/components/Page/Page';
import { useGetRoleQuery } from 'app/api/clients/roles';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { RoleEditForm } from './RoleEditForm';

export default function RoleEditPage() {
  const { uid } = useParams<{ uid: string }>();
  const hasAccess = contextSrv.hasPermission(AccessControlAction.ActionRolesList);

  // Fetch role data if editing (uid === 'new' means creating)
  const isCreating = uid === 'new';
  const { data: role, isLoading } = useGetRoleQuery(
    { roleUid: uid! },
    { skip: isCreating || !uid }
  );

  const pageNav = useMemo<NavModelItem>(() => {
    const roleName = role?.displayName || role?.name || '';
    return {
      text: isCreating
        ? t('admin.role-edit-page.title-new', 'New custom role')
        : roleName || t('admin.role-edit-page.title-edit', 'Edit role'),
      url: `/admin/roles/edit/${uid}`,
    };
  }, [isCreating, role, uid]);

  if (!hasAccess) {
    return (
      <Page navId="admin-roles" pageNav={pageNav}>
        <Page.Contents>
          <p>{t('admin.roles-page.no-permission', 'You do not have permission to view roles.')}</p>
        </Page.Contents>
      </Page>
    );
  }

  if (isLoading) {
    return (
      <Page navId="admin-roles" pageNav={pageNav}>
        <Page.Contents>
          <p>{t('admin.role-edit-page.loading', 'Loading role...')}</p>
        </Page.Contents>
      </Page>
    );
  }

  return (
    <Page navId="admin-roles" pageNav={pageNav}>
      <Page.Contents>
        <RoleEditForm role={isCreating ? undefined : role} onSaved={() => window.history.back()} />
      </Page.Contents>
    </Page>
  );
}
