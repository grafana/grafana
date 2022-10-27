import React, { useContext } from 'react';

import { PluginPageProps } from '@grafana/runtime';
import { PluginPageContext } from 'app/features/plugins/components/PluginPageContext';

import { Page } from '../Page/Page';

export function PluginPage({ children, navId, navModel: navModelProp, pageNav, layout, subTitle }: PluginPageProps) {
  const context = useContext(PluginPageContext);
  // Only set a `navModel` if `navId` is not present. (Otherwise the auto-generated `navModel` would override the `navId` in `<Page>`)
  // Only use the auto-generated `context.sectionNav` if there is no custom `navModel` set
  const navModel = navModelProp || navId ? undefined : context.sectionNav;

  return (
    <Page navId={navId} navModel={navModel} pageNav={pageNav} layout={layout} subTitle={subTitle}>
      <Page.Contents>{children}</Page.Contents>
    </Page>
  );
}
