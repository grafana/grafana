import { Page } from 'app/core/components/Page/Page';

import { ProvisioningWizard } from './ProvisioningWizard';

export default function ConnectPage() {
  return (
    <Page
      navId="provisioning"
      pageNav={{
        text: 'Connect to external storage',
        subTitle: 'Connect to an external storage to manage your resources',
      }}
    >
      <Page.Contents>
        <ProvisioningWizard />
      </Page.Contents>
    </Page>
  );
}
