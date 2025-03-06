import { Page } from 'app/core/components/Page/Page';
import { ProvisioningWizard } from './ProvisioningWizard';

export default function MigratePage() {
  return (
    <Page
      navId="provisioning"
      pageNav={{
        text: 'Migrate Grafana to repository',
        subTitle: 'Migrate your dashboards to the new provisioning system',
      }}
    >
      <Page.Contents>
        <ProvisioningWizard requiresMigration={true} />
      </Page.Contents>
    </Page>
  );
}
