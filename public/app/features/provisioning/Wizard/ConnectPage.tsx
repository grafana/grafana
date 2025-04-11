import { useParams } from 'react-router-dom-v5-compat';

import { Page } from 'app/core/components/Page/Page';

import { ProvisioningWizard } from './ProvisioningWizard';
import { RepoType } from './types';

export default function ConnectPage() {
  const { type } = useParams<{ type: RepoType }>();

  if (!type) {
    return null;
  }

  return (
    <Page
      navId="provisioning"
      pageNav={{
        text: type === 'github' ? 'Configure Git Sync' : 'Configure local file path',
        subTitle: 'Connect to an external storage to manage your resources',
      }}
    >
      <Page.Contents>
        <ProvisioningWizard type={type} />
      </Page.Contents>
    </Page>
  );
}
