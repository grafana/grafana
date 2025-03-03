import { useEffect } from 'react';

import { reportPageview } from '@grafana/runtime';
import { Page } from 'app/core/components/Page/Page';

import { BannerForm } from './BannerForm';
import { useBanner } from './hooks';

export function BannerSettingsPage() {
  const [resource, isLoading] = useBanner();

  useEffect(() => {
    reportPageview();
  }, []);

  return (
    <Page navId="banner-settings">
      <Page.Contents isLoading={isLoading}>
        <BannerForm banner={resource?.spec} name={resource?.metadata?.name ?? ''} />
      </Page.Contents>
    </Page>
  );
}
export default BannerSettingsPage;
