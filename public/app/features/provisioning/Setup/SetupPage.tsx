import { Page } from 'app/core/components/Page/Page';
import { StatusAlerts } from './StatusAlerts';
import { FeatureList } from './FeatureList';

export default function SetupPage() {
  return (
    <Page
      navModel={{ main: { text: '' }, node: { text: 'Provisioning Setup' } }}
      subTitle="Configure your Grafana instance to use provisioning to manage your dashboards using Github and other storage systems."
    >
      <Page.Contents>
        <StatusAlerts showSetupButton={false} showSuccessBanner={true} />
        <FeatureList />
      </Page.Contents>
    </Page>
  );
}
