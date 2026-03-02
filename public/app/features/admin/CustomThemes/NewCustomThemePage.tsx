import { NavModelItem } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Page } from 'app/core/components/Page/Page';

export default function NewCustomThemePage() {
  const pageNav: NavModelItem = {
    icon: 'palette',
    id: 'custom-themes-new',
    text: t('admin.new-custom-theme-page.page-nav.text.add-custom-theme', 'Add custom theme'),
    subTitle: t(
      'admin.new-custom-theme-page.page-nav.subTitle.custom-theme-organization',
      'Add a custom theme for your organization.'
    ),
  };

  return (
    <Page navId="custom-themes" pageNav={pageNav}>
      <Page.Contents>
        <Trans i18nKey="admin.custom-themes.new-page-placeholder">Custom theme form coming soon.</Trans>
      </Page.Contents>
    </Page>
  );
}
