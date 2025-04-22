import { Page } from 'app/core/components/Page/Page';
import { useNavModel } from 'app/core/hooks/useNavModel';

import { Trans } from '../../core/internationalization';

export default function FeatureTogglePage() {
  const navModel = useNavModel('profile-settings');

  return (
    <Page navModel={navModel}>
      <Page.Contents>
        <h1>
          <Trans i18nKey="profile.feature-toggle-page.profile-not-enabled">Profile is not enabled.</Trans>
        </h1>
        <Trans i18nKey="profile.feature-toggles-age.enable-in-config">Enable profile in the Grafana config file.</Trans>
        <div>
          <pre>
            {`[profile]
enable = true
`}
          </pre>
        </div>
      </Page.Contents>
    </Page>
  );
}
