import { NavModel } from '@grafana/data';
import { Page } from 'app/core/components/Page/Page';
import { t } from 'app/core/internationalization';

import { withPageErrorBoundary } from './withPageErrorBoundary';

function FeatureTogglePage() {
  const navModel: NavModel = {
    node: {
      text: t('alerting.feature-toggle-page.nav-model.text.alerting-is-not-enabled', 'Alerting is not enabled'),
      hideFromBreadcrumbs: true,
      subTitle: t(
        'alerting.feature-toggle-page.nav-model.subTitle.enable-alerting-grafana-config',
        'To enable alerting, enable it in the Grafana config'
      ),
    },
    main: {
      text: t('alerting.feature-toggle-page.nav-model.text.alerting-is-not-enabled', 'Alerting is not enabled'),
    },
  };

  return (
    <Page navModel={navModel}>
      <Page.Contents>
        <pre>
          {`[unified_alerting]
enabled = true
`}
        </pre>
      </Page.Contents>
    </Page>
  );
}

export default withPageErrorBoundary(FeatureTogglePage);
