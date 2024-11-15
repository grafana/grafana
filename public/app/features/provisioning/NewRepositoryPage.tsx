import { Page } from 'app/core/components/Page/Page';

import { ConfigForm } from './ConfigForm';
import { useListRepositoryQuery } from './api';

export default function NewRepositoryPage() {
  const query = useListRepositoryQuery();
  return (
    <Page
      navId="provisioning"
      pageNav={{ text: 'Configure repository', subTitle: 'Configure a repository for storing your resources.' }}
    >
      <Page.Contents isLoading={query.isLoading}>
        <ConfigForm />
      </Page.Contents>
    </Page>
  );
}
