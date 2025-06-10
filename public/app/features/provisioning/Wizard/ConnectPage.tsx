import { useParams } from 'react-router-dom-v5-compat';

import { useTranslate } from '@grafana/i18n';
import { Page } from 'app/core/components/Page/Page';

import { ProvisioningWizard } from './ProvisioningWizard';
import { StepStatusProvider } from './StepStatusContext';
import { RepoType } from './types';

export default function ConnectPage() {
  const { t } = useTranslate();
  const { type } = useParams<{ type: RepoType }>();

  if (!type) {
    return null;
  }

  return (
    <Page
      navId="provisioning"
      pageNav={{
        text: type === 'github' ? 'Configure Git Sync' : 'Configure local file path',
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
