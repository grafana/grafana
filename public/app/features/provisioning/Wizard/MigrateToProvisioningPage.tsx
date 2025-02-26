import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom-v5-compat';

import { Page } from 'app/core/components/Page/Page';

import { StatusAlerts } from '../Setup/StatusAlerts';
import { useGetFrontendSettingsQuery } from '../api';
import { PROVISIONING_URL } from '../constants';

import { ProvisioningWizard } from './ProvisioningWizard';

export default function MigrateToProvisioningPage() {
  const settings = useGetFrontendSettingsQuery();
  const navigate = useNavigate();
  useEffect(() => {
    if (settings.data) {
      // Do not run the migration wizard if you are already using unified storage
      if (!Boolean(settings.data.legacyStorage)) {
        navigate(PROVISIONING_URL);
      }
      // Do not run the migration wizard if something is already targeting the instance
      if (settings.data.items.find((v) => v.target === 'instance')) {
        navigate(PROVISIONING_URL);
      }
    }
  }, [settings.data, navigate]);

  return (
    <Page
      navId="provisioning"
      pageNav={{ text: 'Migrate to Provisioning', subTitle: 'Manage this instance from provisioning' }}
    >
      <Page.Contents>
        <StatusAlerts />
        <ProvisioningWizard />
      </Page.Contents>
    </Page>
  );
}
