import { t } from '@grafana/i18n';
import { PublicDashboardShareType } from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/SharePublicDashboardUtils';

export const getAnyOneWithTheLinkShareOption = () => {
  return {
    label: t('public-dashboard.share-externally.public-share-type-option-label', 'Anyone with the link'),
    description: t(
      'public-dashboard.share-externally.public-share-type-option-description',
      'Anyone with the link can access dashboard'
    ),
    value: PublicDashboardShareType.PUBLIC,
    icon: 'globe',
  };
};

export const getOnlySpecificPeopleShareOption = () => ({
  label: t('public-dashboard.share-externally.email-share-type-option-label', 'Only specific people'),
  description: t(
    'public-dashboard.share-externally.email-share-type-option-description',
    'Only people with the link can access dashboard'
  ),
  value: PublicDashboardShareType.EMAIL,
  icon: 'users-alt',
});
