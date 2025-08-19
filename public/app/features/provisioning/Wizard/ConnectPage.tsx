import { useParams } from 'react-router-dom-v5-compat';

import { t } from '@grafana/i18n';
import { Page } from 'app/core/components/Page/Page';

import { isGitProvider } from '../utils/repositoryTypes';

import { ProvisioningWizard } from './ProvisioningWizard';
import { StepStatusProvider } from './StepStatusContext';
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
        text: isGitProvider(type) ? 'Configure Git Sync' : 'Configure local file path',
        subTitle: t(
          'provisioning.connect-page.subTitle.connect-external-storage-manage-resources',
          'Connect to an external storage to manage your resources'
        ),
      }}
    >
      <Page.Contents>
        <StepStatusProvider>
          <ProvisioningWizard type={type} />
        </StepStatusProvider>
      </Page.Contents>
    </Page>
  );
}
