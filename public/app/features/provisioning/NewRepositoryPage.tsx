import { Page } from 'app/core/components/Page/Page';

import { ConfigForm } from './ConfigForm';
import { StatusAlerts } from './Setup/StatusAlerts';

export default function NewRepositoryPage() {
  return (
    <Page
      navId="provisioning"
      pageNav={{ text: 'Configure repository', subTitle: 'Configure a repository for storing your resources.' }}
    >
      <Page.Contents>
        <StatusAlerts />
        <ConfigForm />
      </Page.Contents>
    </Page>
  );
}
