import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom-v5-compat';

import { Page } from 'app/core/components/Page/Page';

import { SetupWarnings } from '../SetupWarnings';
import { useGetFrontendSettingsQuery } from '../api';
import { PROVISIONING_URL } from '../constants';

import { ProvisioningWizard } from './ProvisioningWizard';

export default function MigrateToProvisioningPage() {
  const settingsQuery = useGetFrontendSettingsQuery();
  const navigate = useNavigate();
  const configChecked = useRef(false);

  useEffect(() => {
    // Only run the redirect logic on the initial success load, not on subsequent data updates
    if (settingsQuery.isSuccess && !configChecked.current) {
      configChecked.current = true;
      if (settingsQuery.data) {
        // Do not run the migration wizard if you are already using unified storage
        if (!Boolean(settingsQuery.data.legacyStorage)) {
          navigate(PROVISIONING_URL);
        }
        // Do not run the migration wizard if something is already targeting the instance
        if (settingsQuery.data.items.find((v) => v.target === 'instance')) {
          navigate(PROVISIONING_URL);
        }
      }
    }
  }, [settingsQuery.data, navigate, settingsQuery.isSuccess]);

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
