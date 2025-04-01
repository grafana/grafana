import { Repository } from 'app/api/clients/provisioning';
import { Page } from 'app/core/components/Page/Page';
import { t } from 'app/core/internationalization';

import GettingStarted from './GettingStarted';
interface Props {
  items: Repository[];
}

export default function GettingStartedPage({ items }: Props) {
  return (
    <Page
      navId="provisioning"
      pageNav={{
        text: t('provisioning.getting-started-page.text-remote-provisioning', 'Remote provisioning'),
        subTitle: t(
          'provisioning.getting-started-page.subtitle-provisioning-feature',
          'Provisioning is a feature that allows you to manage your dashboards using GitHub and other storage systems'
        ),
      }}
    >
      <Page.Contents>
        <GettingStarted items={items} />
      </Page.Contents>
    </Page>
  );
}
