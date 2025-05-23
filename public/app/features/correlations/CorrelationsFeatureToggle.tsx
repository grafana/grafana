import { Trans } from '@grafana/i18n';
import { Page } from 'app/core/components/Page/Page';

export default function FeatureTogglePage() {
  return (
    <Page navId="correlations">
      <Page.Contents>
        <h1>
          <Trans i18nKey="correlations.page-heading">Correlations are disabled</Trans>
        </h1>
        <Trans i18nKey="correlations.page-content">To enable Correlations, add it in the Grafana config:</Trans>
        <div>
          <pre>
            {`[feature_toggles]
correlations = true
`}
          </pre>
        </div>
      </Page.Contents>
    </Page>
  );
}
