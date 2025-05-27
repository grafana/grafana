import { useParams } from 'react-router-dom-v5-compat';

import { Page } from 'app/core/components/Page/Page';

import { ProvisioningWizard } from './ProvisioningWizard';
import { RepoType } from './types';

export default function ConnectPage() {
  const { type } = useParams<{ type: RepoType }>();

  if (!type) {
    return null;
  }

  const pageTitle = type === 'github' ? 'Configure Github Sync' : type === 'git' ? 'Configure Git Sync' : 'Configure local file path';

  return (
    <Page
      navId="provisioning"
      pageNav={{
        text: pageTitle,
        subTitle: 'Connect to an external storage to manage your resources',
      }}
    >
      <Page.Contents>
        <ProvisioningWizard type={type} />
      </Page.Contents>
    </Page>
  );
}
