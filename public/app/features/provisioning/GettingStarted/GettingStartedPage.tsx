import { t } from '@grafana/i18n';
import { type Repository } from 'app/api/clients/provisioning/v0alpha1';
import { Page } from 'app/core/components/Page/Page';

import GettingStarted from './GettingStarted';

interface Props {
  items: Repository[];
}

export default function GettingStartedPage({ items }: Props) {
  return (
    <Page
      navId="provisioning"
      subTitle={t(
        'provisioning.getting-started-page.subtitle-provisioning-feature',
        'View and manage your provisioning connections'
      )}
    >
      <Page.Contents>
        <GettingStarted items={items} />
      </Page.Contents>
    </Page>
  );
}
