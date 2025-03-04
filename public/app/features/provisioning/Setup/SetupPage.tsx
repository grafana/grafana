import { Page } from 'app/core/components/Page/Page';

import { FeatureList } from './FeatureList';
import { StatusAlerts } from './StatusAlerts';

export default function SetupPage() {
  return (
    <Page
      navModel={{ main: { text: '' }, node: { text: 'Provisioning Setup' } }}
      subTitle="Configure your Grafana instance to use provisioning to manage your dashboards using GitHub and other storage systems."
    >
      <Page.Contents>
        <StatusAlerts showSetupButton={false} showSuccessBanner={true} />
        <FeatureList />
      </Page.Contents>
    </Page>
  );
}
