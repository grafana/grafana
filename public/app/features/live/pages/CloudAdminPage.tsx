import React from 'react';
import Page from 'app/core/components/Page/Page';
import { useNavModel } from 'app/core/hooks/useNavModel';

export default function CloudAdminPage() {
  const navModel = useNavModel('live-cloud');

  return (
    <Page navModel={navModel}>
      <Page.Contents>TODO... CLOUD!!! admin/status</Page.Contents>
    </Page>
  );
}
