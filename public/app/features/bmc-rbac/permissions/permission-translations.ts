import { t } from 'app/core/internationalization';

import { Permission } from './state/types';

export function getPermissionsDisplayName(name: string) {
  switch (name) {
    case 'administration.datasources:manage':
      return t('bmc.rbac.permissions.admin.datasource-manage', 'Manage datasources');
    case 'administration.reports:manage':
      return t('bmc.rbac.permissions.admin.reports-manage', 'Manage report scheduler');
    case 'calculated.fields:create':
      return t('bmc.rbac.permissions.common.create', 'Create');
    case 'calculated.fields:read':
      return t('bmc.rbac.permissions.common.view', 'View');
    case 'dashboards:create':
      return t('bmc.rbac.permissions.common.create', 'Create');
    case 'dashboards:download':
      return t('bmc.common.download', 'Download');
    case 'dashboards:read':
      return t('bmc.rbac.permissions.common.view', 'View');
    case 'datasources:explore':
      return t('bmc.rbac.permissions.datasource.explore', 'Explore');
    case 'folders:create':
      return t('bmc.rbac.permissions.common.create', 'Create');
    case 'folders:read':
      return t('bmc.rbac.permissions.common.view', 'View');
    case 'reports:access':
      return t('bmc.rbac.permissions.reports.access', 'Access');
    case 'reports.history:read':
      return t('bmc.rbac.permissions.reports.history-read', 'View history');
    case 'reports.settings:read':
      return t('bmc.rbac.permissions.reports.settings-read', 'View settings');
    case 'servicemanagement.querytypes:sql':
      return t('bmc.rbac.permissions.servicemanagement-querytypes.sql', 'SQL');
    case 'insightfinder:access':
      return t('bmc.rbac.permissions.insightfinder.access', 'Access');
    case 'insightfinder.dashboards:create':
      return t('bmc.rbac.permissions.insightfinder.dashboards-create', 'Create dashboards');
    case 'reports.dynamic.recipients:access':
      return t('bmc.rbac.permissions.reports.recipients-dash-access', 'Dynamic recipients');
    default:
      return 'NA';
  }
}

export function getPermissionsGroup(groupName: string) {
  switch (groupName) {
    case 'Administration':
      return t('bmc.rbac.permissions.admin.title', 'Administration');
    case 'Calculated fields':
      return t('bmc.calc-fields.title', 'Calculated fields');
    case 'Dashboards':
      return t('bmc.common.dashboards', 'Dashboards');
    case 'Datasources':
      return t('bmc.rbac.permissions.datasources.title', 'Datasources');
    case 'Folders':
      return t('bmc.rbac.permissions.folders.title', 'Folders');
    case 'Reports':
      return t('bmc.rbac.permissions.reports.title', 'Reports');
    case 'Service management query types':
      return t('bmc.rbac.permissions.servicemanagement-querytypes.title', 'Service management query types');
    case 'Insight Finder':
      return t('bmc.rbac.permissions.insightfinder.title', 'Insight Finder');
    default:
      return 'NA';
  }
}

export function getPermissionsDesc(name: string) {
  switch (name) {
    case 'administration.datasources:manage':
      return t('bmc.rbac.permissions.admin.datasource-manage-desc', 'can manage datasources');
    case 'administration.reports:manage':
      return t('bmc.rbac.permissions.admin.reports-manage-desc', 'can manage all reports');
    case 'calculated.fields:create':
      return t('bmc.rbac.permissions.calc-fields.create-desc', 'can create or update calculated fields');
    case 'calculated.fields:read':
      return t('bmc.rbac.permissions.calc-fields.view-desc', 'can view calculated fields');
    case 'dashboards:create':
      return t('bmc.rbac.permissions.dashboards.create-desc', 'can create dashboards');
    case 'dashboards:download':
      return t('bmc.rbac.permissions.dashboards.download-desc', 'can download dashboard as pdf/xlsx/csv');
    case 'dashboards:read':
      return t('bmc.rbac.permissions.dashboards.view-desc', 'can view permitted dashboards');
    case 'datasources:explore':
      return t('bmc.rbac.permissions.datasource.explore-desc', 'can use explore mode for datasources');
    case 'folders:create':
      return t('bmc.rbac.permissions.folders.create-desc', 'can create folders');
    case 'folders:read':
      return t('bmc.rbac.permissions.folders.view-desc', 'can view permitted folders');
    case 'reports:access':
      return t('bmc.rbac.permissions.reports.access-desc', 'can view and create reports');
    case 'reports.history:read':
      return t('bmc.rbac.permissions.reports.history-read-desc', 'can view reports history section');
    case 'reports.settings:read':
      return t('bmc.rbac.permissions.reports.settings-read-desc', 'can view reports settings');
    case 'servicemanagement.querytypes:sql':
      return t('bmc.rbac.permissions.servicemanagement-querytypes.sql-desc', 'can edit sql query');
    case 'insightfinder:access':
      return t('bmc.rbac.permissions.insightfinder.access-desc-tooltip', 'can access insight finder');
    case 'insightfinder.dashboards:create':
      return t(
        'bmc.rbac.permissions.insightfinder.dashboards-create-desc',
        'can create dashboards through insight finder'
      );
    case 'reports.dynamic.recipients:access':
      return t(
        'bmc.rbac.permissions.reports.recipients-dash-access-desc',
        'Can add recipients dynamically from dashboard in schedule'
      );
    default:
      return 'NA';
  }
}

export function translatePermissions(permissions: Permission[]): Permission[] {
  return permissions.map((perm) => {
    return { ...perm, displayName: getPermissionsDisplayName(perm.name), description: getPermissionsDesc(perm.name) };
  });
}
