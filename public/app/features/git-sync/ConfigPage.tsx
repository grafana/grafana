import { Page } from 'app/core/components/Page/Page';

import { ConfigForm } from './ConfigForm';
import { useProvisioningConfig } from './hooks';

export default function ConfigPage() {
  const config = useProvisioningConfig();
  return (
    <Page navId="git-sync" subTitle="Store and version control your resources">
      <Page.Contents isLoading={false}>
        <ConfigForm />
      </Page.Contents>
    </Page>
  );
}
