import { NavModelItem } from '@grafana/data';
import { t } from '@grafana/i18n';
import { UserDTO } from 'app/types/user';

export function buildUserNavModel(user: UserDTO | null, uid: string): NavModelItem {
  const navModel: NavModelItem = {
    text: user?.name || user?.login || t('admin.build-user-nav-model.user', 'User'),
    img: user?.avatarUrl,
    id: `user-${uid}`,
    subTitle: user?.email || '',
    url: `/admin/users/${uid}/information`,
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
    url: `/admin/users/${uid}/information`,
  });

  // Roles tab — ships in UI PR 1
  // Resource Access tab — ships in UI PR 6

  return navModel;
}
