import React from 'react';

import { Page } from 'app/core/components/Page/Page';
import { useNavModel } from 'app/core/hooks/useNavModel';

export default function CloudAdminPage() {
  const navModel = useNavModel('live-status');

  return (
    <Page navModel={navModel}>
      <Page.Contents>Live/Live/Live</Page.Contents>
    </Page>
  );
}
