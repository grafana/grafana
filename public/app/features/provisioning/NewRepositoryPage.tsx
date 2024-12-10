import { Page } from 'app/core/components/Page/Page';

import { ConfigForm } from './ConfigForm';

export default function NewRepositoryPage() {
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
