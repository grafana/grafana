import { t } from '@grafana/i18n';
import permissionsScreenshot from 'img/permissions-screenshot.png';

import { FeatureHighlightsTabPage } from '../components/FeatureHighlightsTabPage/FeatureHighlightsTabPage';
import { Footer } from '../components/FeatureHighlightsTabPage/Footer';
import { Footnote } from '../components/FeatureHighlightsTabPage/Footnote';

export function PermissionsFeatureHighlightPage() {
  return (
    <FeatureHighlightsTabPage
      pageName="permissions"
      title={t(
        'connections.permissions-feature-highlight-page.title',
        'Get started with data source permissions in Grafana Cloud'
      )}
      header={t(
        'connections.permissions-feature-highlight-page.header',
        'With data source permissions, you can protect sensitive data by limiting access to this data source to specific users, teams, and roles.'
      )}
      items={[
        t(
          'connections.permissions-feature-highlight-page.item-1',
          'Protect sensitive data, like security logs, production databases, and personally-identifiable information'
        ),
        t(
          'connections.permissions-feature-highlight-page.item-2',
          'Clean up users’ experience by hiding data sources they don’t need to use'
        ),
        t(
          'connections.permissions-feature-highlight-page.item-3',
          'Share Grafana access more freely, knowing that users will not unwittingly see sensitive data'
        ),
      ]}
      footer={<Footer />}
      linkButtonLabel={t('connections.permissions-feature-highlight-page.link-button-label', 'Create account')}
      buttonLink={'https://grafana.com/auth/sign-up/create-user'}
      footNote={<Footnote />}
      screenshotPath={permissionsScreenshot}
    />
  );
}
