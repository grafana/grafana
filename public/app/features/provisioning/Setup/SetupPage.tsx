import { Page } from 'app/core/components/Page/Page';
import { SetupWarnings } from './SetupWarnings';
import { SetupFeatures } from './SetupFeatures';

export default function SetupPage() {
  return (
    <Page
      navModel={{ main: { text: '' }, node: { text: 'Provisioning Setup' } }}
      subTitle="Configure your Grafana instance to use provisioning to manage your dashboards using Github and other storage systems."
    >
      <Page.Contents>
        <SetupWarnings showSetupButton={false} showSuccessBanner={true} />
        <SetupFeatures />
      </Page.Contents>
    </Page>
  );
}
