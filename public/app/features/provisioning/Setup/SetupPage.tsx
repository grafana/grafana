import { Page } from 'app/core/components/Page/Page';

import { FeatureList } from './FeatureList';

// This page is only exists if required feature toggles are missing
export default function SetupPage() {
  return (
    <Page
      navModel={{ main: { text: '' }, node: { text: 'Provisioning Setup' } }}
      subTitle="Configure your Grafana instance to use provisioning to manage your dashboards using Github and other storage systems."
    >
      <Page.Contents>
        <FeatureList />
      </Page.Contents>
    </Page>
  );
}
