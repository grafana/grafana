import { useNavigate } from 'react-router-dom-v5-compat';

import { Page } from 'app/core/components/Page/Page';

import { SetupWarnings } from '../SetupWarnings';
import { useGetFrontendSettingsQuery } from '../api';
import { PROVISIONING_URL } from '../constants';

import { ProvisioningWizard } from './ProvisioningWizard';

export default function MigrateToProvisioningPage() {
  const settings = useGetFrontendSettingsQuery();
  const navigate = useNavigate();
  if (settings.data) {
    // Do run the migration wizard if you are already using unified storage
    if (!Boolean(settings.data.legacyStorage)) {
      navigate(PROVISIONING_URL);
    }
    // Do run the migration wizard if something is already targeting the instance
    if (settings.data.items.find((v) => v.target === 'instance')) {
      navigate(PROVISIONING_URL);
    }
  }

  return (
    <Page
      navId="provisioning"
      pageNav={{ text: 'Migrate to Provisioning', subTitle: 'Manage this instance from provisioning' }}
    >
      <Page.Contents>
        <SetupWarnings />
        <ProvisioningWizard />
      </Page.Contents>
    </Page>
  );
}
