import { NavModelItem } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { UserDTO } from 'app/types/user';

export function buildUserNavModel(user: UserDTO | null, uid: string): NavModelItem {
  const navModel: NavModelItem = {
    text: user?.name || user?.login || t('admin.build-user-nav-model.user', 'User'),
    img: user?.avatarUrl,
    id: `user-${uid}`,
    subTitle: user?.email || '',
    url: `/admin/users/edit/${uid}/information`,
    children: [],
  };

  if (!user) {
    return navModel;
  }

  // Information tab (always visible)
  navModel.children!.push({
    active: false,
    icon: 'info-circle',
    id: `user-information-${uid}`,
    text: t('admin.build-user-nav-model.information', 'Information'),
    url: `/admin/users/edit/${uid}/information`,
  });

  // Roles tab (Enterprise only with RBAC)
  if (contextSrv.licensedAccessControlEnabled()) {
    navModel.children!.push({
      active: false,
      icon: 'shield',
      id: `user-roles-${uid}`,
      text: t('admin.build-user-nav-model.roles', 'Roles'),
      url: `/admin/users/edit/${uid}/roles`,
    });
  }

  // Resource Access tab (Permission Lens)
  if (config.featureToggles.permissionLens) {
    navModel.children!.push({
      active: false,
      icon: 'eye',
      id: `user-resourceaccess-${uid}`,
      text: t('admin.build-user-nav-model.resource-access', 'Resource Access'),
      url: `/admin/users/edit/${uid}/resourceaccess`,
    });
  }

  return navModel;
}
