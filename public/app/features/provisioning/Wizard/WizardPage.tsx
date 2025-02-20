import { Page } from 'app/core/components/Page/Page';

import { SetupWarnings } from '../SetupWarnings';

import { ProvisioningWizard } from './ProvisioningWizard';

export default function NewRepositoryPage() {
  return (
    <Page
      navId="provisioning"
      pageNav={{ text: 'Configure repository', subTitle: 'Migrate instance to provisioning.' }}
    >
      <Page.Contents>
        <SetupWarnings />
        <ProvisioningWizard />
      </Page.Contents>
    </Page>
  );
}
