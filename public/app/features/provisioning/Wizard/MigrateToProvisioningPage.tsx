import { Page } from 'app/core/components/Page/Page';

import { SetupWarnings } from '../SetupWarnings';

import { ProvisioningWizard } from './ProvisioningWizard';

export default function MigrateToProvisioningPage() {
  return (
    <Page
      navId="provisioning"
      pageNav={{ text: 'Migrate to Provisioning', subTitle: 'Manage this instance from provisioning' }}
    >
      <Page.Contents>
        <SetupWarnings />
        <ProvisioningWizard />
      </Page.Contents>
    </Page>
  );
}
