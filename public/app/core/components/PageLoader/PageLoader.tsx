import { PageLoader as PageLoaderUI } from '@grafana/ui';

import { Branding } from '../Branding/Branding';

export default function PageLoader() {
  return (
    <PageLoaderUI>
      <Branding.LoginLogo />
    </PageLoaderUI>
  );
}
