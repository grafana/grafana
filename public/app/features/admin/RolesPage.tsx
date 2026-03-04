import { css } from '@emotion/css';
import { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Tab, TabsBar, useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction, Role } from 'app/types/accessControl';

import { RoleEditForm } from './RoleEditForm';
import { RolesListTab } from './RolesListTab';

enum TabView {
  LIST = 'list',
  EDITOR = 'editor',
}

export default function RolesPage() {
  const styles = useStyles2(getStyles);
  const hasAccess = contextSrv.hasPermission(AccessControlAction.ActionRolesList);

  const [view, setView] = useState<TabView>(TabView.LIST);
  const [editingRole, setEditingRole] = useState<Role | undefined>(undefined);

  if (!hasAccess) {
    return (
      <Page navId="admin-roles" >
        <Page.Contents>
          <p>{t('admin.roles-page.no-permission', 'You do not have permission to view roles.')}</p>
        </Page.Contents>
      </Page>
    );
  }

  const onEditRole = (role: Role) => {
    setEditingRole(role);
    setView(TabView.EDITOR);
  };

  const onCreateRole = () => {
    setEditingRole(undefined);
    setView(TabView.EDITOR);
  };

  const onSaved = () => {
    setEditingRole(undefined);
    setView(TabView.LIST);
  };

  return (
    <Page navId="admin-roles" >
      <TabsBar className={styles.tabsMargin}>
        <Tab
          label={t('admin.roles-page.tab-all-roles', 'All roles')}
          active={view === TabView.LIST}
          onChangeTab={() => {
            setEditingRole(undefined);
            setView(TabView.LIST);
          }}
        />
        <Tab
          label={
            editingRole
              ? t('admin.roles-page.tab-edit-role', 'Edit role')
              : t('admin.roles-page.tab-create-role', 'Create custom role')
          }
          active={view === TabView.EDITOR}
          onChangeTab={onCreateRole}
        />
      </TabsBar>
      {view === TabView.LIST && <RolesListTab onEditRole={onEditRole} onCreateRole={onCreateRole} />}
      {view === TabView.EDITOR && <RoleEditForm role={editingRole} onSaved={onSaved} />}
    </Page>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  tabsMargin: css({
    marginBottom: theme.spacing(3),
  }),
});
