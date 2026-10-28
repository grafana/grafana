import { PageLayoutType } from '@grafana/data';
import { type SceneComponentProps } from '@grafana/scenes';
import { Permissions } from 'app/core/components/AccessControl/Permissions';
import { Page } from 'app/core/components/Page/Page';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { NavToolbarActions } from '../scene/NavToolbarActions';

import { type PermissionsEditView } from './PermissionsEditView';
import { useDashboardEditPageNav } from './utils';

export function PermissionsEditViewRenderer({ model }: SceneComponentProps<PermissionsEditView>) {
  const dashboard = model.getDashboard();
  const { uid } = dashboard.useState();
  const { navModel, pageNav } = useDashboardEditPageNav(dashboard, model.getUrlKey());
  const canSetPermissions = contextSrv.hasPermission(AccessControlAction.DashboardsPermissionsWrite);

  return (
    <Page navModel={navModel} pageNav={pageNav} layout={PageLayoutType.Standard}>
      <NavToolbarActions dashboard={dashboard} />
      <Permissions resource={'dashboards'} resourceId={uid ?? ''} canSetPermissions={canSetPermissions} />
    </Page>
  );
}
