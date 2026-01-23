import { NavModel } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Page } from 'app/core/components/Page/Page';

import { withPageErrorBoundary } from './withPageErrorBoundary';

function FeatureTogglePage() {
  const alertingEnabled = config.unifiedAlertingEnabled;
  const alertingUIEnabled = config.unifiedAlertingUIEnabled !== false;
  const isAlertingUIHidden = alertingEnabled && !alertingUIEnabled;

  const titleText = isAlertingUIHidden
    ? t('alerting.feature-toggle-page.nav-model.text.alerting-ui-hidden', 'Alerting UI is hidden')
    : t('alerting.feature-toggle-page.nav-model.text.alerting-is-not-enabled', 'Alerting is not enabled');
  const subTitleText = isAlertingUIHidden
    ? t(
        'alerting.feature-toggle-page.nav-model.subTitle.enable-alerting-ui-grafana-config',
        'To show the alerting UI, enable it in the Grafana config'
      )
    : t(
        'alerting.feature-toggle-page.nav-model.subTitle.enable-alerting-grafana-config',
        'To enable alerting, enable it in the Grafana config'
      );
  const snippet = isAlertingUIHidden
    ? `[unified_alerting]
ui_enabled = true
`
    : `[unified_alerting]
enabled = true
`;
    ? t('alerting.feature-toggle-page.nav-model.text.alerting-is-not-enabled', 'Alerting is not enabled')
    : t('alerting.feature-toggle-page.nav-model.text.alerting-ui-hidden', 'Alerting UI is hidden');
  const subTitleText = isAlertingDisabled
    ? t(
        'alerting.feature-toggle-page.nav-model.subTitle.enable-alerting-grafana-config',
        'To enable alerting, enable it in the Grafana config'
      )
    : t(
        'alerting.feature-toggle-page.nav-model.subTitle.enable-alerting-ui-grafana-config',
        'To show the alerting UI, enable it in the Grafana config'
      );
  const snippet = isAlertingDisabled
    ? `[unified_alerting]
enabled = true
`
    : `[unified_alerting]
ui_enabled = true
`;

  const navModel: NavModel = {
    node: {
      text: titleText,
      hideFromBreadcrumbs: true,
      subTitle: subTitleText,
    },
    main: {
      text: titleText,
    },
  };

  return (
    <Page navModel={navModel}>
      <Page.Contents>
        <pre>{snippet}</pre>
      </Page.Contents>
    </Page>
  );
}

export default withPageErrorBoundary(FeatureTogglePage);
