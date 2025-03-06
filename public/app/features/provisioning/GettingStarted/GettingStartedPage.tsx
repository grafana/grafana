import { Page } from 'app/core/components/Page/Page';

import GettingStarted from './GettingStarted';

export default function GettingStartedPage() {
  return (
    <Page
      navId="provisioning"
      pageNav={{
        text: 'Getting started with Provisioning',
        subTitle:
          'Provisioning is a feature that allows you to manage your dashboards using GitHub and other storage systems',
      }}
    >
      <Page.Contents>
        <GettingStarted />
      </Page.Contents>
    </Page>
  );
}
