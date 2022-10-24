import React, { useContext } from 'react';

import { PluginPageProps } from '@grafana/runtime';
import { PluginPageContext } from 'app/features/plugins/components/PluginPageContext';

import { Page } from '../Page/Page';

export function PluginPage({ children, pageNav, layout, subTitle }: PluginPageProps) {
  const context = useContext(PluginPageContext);

  return (
    <Page navModel={context.sectionNav} pageNav={pageNav} layout={layout} subTitle={subTitle}>
      <Page.Contents>{children}</Page.Contents>
    </Page>
  );
}
