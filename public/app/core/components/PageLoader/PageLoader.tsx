import { PageLoader as PageLoaderUI } from '@grafana/ui';

import { Branding } from '../Branding/Branding';

export function PageLoader() {
  return (
    <PageLoaderUI>
      <Branding.LoginLogo />
    </PageLoaderUI>
  );
}
