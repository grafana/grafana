import { Repository } from 'app/api/clients/provisioning';
import { Page } from 'app/core/components/Page/Page';

import GettingStarted from './GettingStarted';
interface Props {
  items: Repository[];
}

export default function GettingStartedPage({ items }: Props) {
  return (
    <Page
      navId="provisioning"
      pageNav={{
        text: 'Remote provisioning',
        subTitle:
          'Provisioning is a feature that allows you to manage your dashboards using GitHub and other storage systems',
      }}
    >
      <Page.Contents>
        <GettingStarted items={items} />
      </Page.Contents>
    </Page>
  );
}
