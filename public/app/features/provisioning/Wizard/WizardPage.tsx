import { Page } from 'app/core/components/Page/Page';

import { SetupWarnings } from '../SetupWarnings';

import { ProvisioningWizard } from './ProvisioningWizard';

export default function NewRepositoryPage() {
  return (
    <Page
      navId="provisioning"
      pageNav={{ text: 'Configure repository', subTitle: 'Configure a repository for storing your resources.' }}
    >
      <Page.Contents>
        <SetupWarnings />
        <ProvisioningWizard
          onSubmit={(data: any) => {
            console.log('d', data);
          }}
        />
      </Page.Contents>
    </Page>
  );
}
