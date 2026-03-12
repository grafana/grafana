import { NavModelItem } from '@grafana/data';
import { t } from '@grafana/i18n';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';
import { ServiceAccountDTO } from 'app/types/serviceaccount';

export function buildNavModel(serviceAccount: ServiceAccountDTO | null, uid: string): NavModelItem {
  const navModel: NavModelItem = {
    text: serviceAccount?.name || 'Service Account',
    img: serviceAccount?.avatarUrl,
    id: `serviceaccount-${uid}`,
    subTitle: t(
      'serviceaccounts.build-nav-model.subtitle',
      'Manage settings for an individual service account.'
    ),
    url: `/org/serviceaccounts/edit/${uid}`,
    children: [],
  };

  if (!serviceAccount) {
    return navModel;
  }

  // Information tab (always visible)
  navModel.children!.push({
    active: false,
    icon: 'info-circle',
    id: `serviceaccount-information-${uid}`,
    text: t('serviceaccounts.build-nav-model.information', 'Information'),
    url: `/org/serviceaccounts/edit/${uid}/information`,
  });

  // Tokens tab (always visible)
  navModel.children!.push({
    active: false,
    icon: 'key-skeleton-alt',
    id: `serviceaccount-tokens-${uid}`,
    text: t('serviceaccounts.build-nav-model.tokens', 'Tokens'),
    url: `/org/serviceaccounts/edit/${uid}/tokens`,
  });

  // Management tab (requires permission to view)
  if (
    !serviceAccount.isExternal &&
    contextSrv.hasPermissionInMetadata(AccessControlAction.ServiceAccountsPermissionsRead, serviceAccount)
  ) {
    navModel.children!.push({
      active: false,
      icon: 'users-alt',
      id: `serviceaccount-management-${uid}`,
      text: t('serviceaccounts.build-nav-model.management', 'Management'),
      url: `/org/serviceaccounts/edit/${uid}/management`,
    });
  }

  // Roles tab — ships in UI PR 1
  // Resource Access tab — ships in UI PR 6

  return navModel;
}
