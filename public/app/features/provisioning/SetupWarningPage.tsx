import { Page } from 'app/core/components/Page/Page';

import { SetupWarnings } from './SetupWarnings';

export default function SetupWarningPage() {
  return (
    <Page navModel={{ main: { text: '' }, node: { text: 'Provisioning' } }} subTitle="Provisioning is not configured">
      <Page.Contents>
        <SetupWarnings />
      </Page.Contents>
    </Page>
  );
}
