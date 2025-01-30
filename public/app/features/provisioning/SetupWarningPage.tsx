import { Alert } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';

import { SetupWarnings } from './SetupWarnings';

export default function SetupWarningPage() {
  return (
    <Page navModel={{ main: { text: '' }, node: { text: 'Provisioning' } }} subTitle="Provisioning is not configured">
      <Page.Contents>
        <Alert title="Feature branch required" severity="error">
          <div>
            Provisioning requires running from a feature branch.
            <br />
            See{' '}
            <a href="https://github.com/grafana/grafana/pull/96329">https://github.com/grafana/grafana/pull/96329</a>
          </div>
        </Alert>

        <SetupWarnings />
      </Page.Contents>
    </Page>
  );
}
