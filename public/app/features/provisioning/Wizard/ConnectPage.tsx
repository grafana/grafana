import { useNavigate } from 'react-router-dom-v5-compat';

import { AppEvents } from '@grafana/data';
import appEvents from 'app/core/app_events';
import { Page } from 'app/core/components/Page/Page';

import { useGetFrontendSettingsQuery } from '../api';
import { PROVISIONING_URL } from '../constants';

import { ProvisioningWizard } from './ProvisioningWizard';

export default function ConnectPage() {
  const settingsQuery = useGetFrontendSettingsQuery();
  const navigate = useNavigate();
  if (settingsQuery.data && settingsQuery.data.items.some((item) => item.target === 'instance')) {
    appEvents.publish({
      type: AppEvents.alertError.name,
      payload: ['Instance repository already exists'],
    });
    navigate(PROVISIONING_URL);
    return;
  }

  return (
    <Page
      navId="provisioning"
      pageNav={{ text: 'Connect to repository', subTitle: 'Connect to a repository to manage your resources' }}
    >
      <Page.Contents isLoading={settingsQuery.isLoading}>
        <ProvisioningWizard />
      </Page.Contents>
    </Page>
  );
}
