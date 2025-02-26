import { Page } from 'app/core/components/Page/Page';
import { SetupWarnings } from './SetupWarnings';
import { SetupWizard } from './SetupWizard/SetupWizard';

export default function SetupWarningPage() {
  return (
    <Page
      navModel={{ main: { text: '' }, node: { text: 'Provisioning Setup' } }}
      subTitle="Configure your Grafana instance to use provisioning to manage your dashboards using Github and other storage systems."
    >
      <Page.Contents>
        <SetupWarnings showSetupButton={false} showSuccessBanner={true} />
        <SetupWizard />
      </Page.Contents>
    </Page>
  );
}
