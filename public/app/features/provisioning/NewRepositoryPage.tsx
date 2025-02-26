import { Page } from 'app/core/components/Page/Page';

import { ConfigForm } from './ConfigForm';
import { SetupWarnings } from './Setup/SetupWarnings';

export default function NewRepositoryPage() {
  return (
    <Page
      navId="provisioning"
      pageNav={{ text: 'Configure repository', subTitle: 'Configure a repository for storing your resources.' }}
    >
      <Page.Contents>
        <SetupWarnings />
        <ConfigForm />
      </Page.Contents>
    </Page>
  );
}
