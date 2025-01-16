import { Page } from 'app/core/components/Page/Page';

import { ConfigForm } from './ConfigForm';
import { checkSetup } from './setup_warnings';

export default function NewRepositoryPage() {
  checkSetup();

  return (
    <Page
      navId="provisioning"
      pageNav={{ text: 'Configure repository', subTitle: 'Configure a repository for storing your resources.' }}
    >
      <Page.Contents>
        <ConfigForm />
      </Page.Contents>
    </Page>
  );
}
