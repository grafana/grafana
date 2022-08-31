import React, { useContext } from 'react';

import { PluginPageLayout, PluginPageProps } from '@grafana/runtime';
import { PluginPageContext } from 'app/features/plugins/components/PluginPageContext';

import { Page } from '../Page/Page';
import { PageLayoutType } from '../Page/types';

export function PluginPage({ children, pageNav, layout }: PluginPageProps) {
  const context = useContext(PluginPageContext);
  const pageLayout = getPageLayout(layout);

  return (
    <Page navModel={context.sectionNav} pageNav={pageNav} layout={pageLayout}>
      {children}
    </Page>
  );
}

function getPageLayout(layout: PluginPageLayout | undefined): PageLayoutType {
  if (layout && layout === PluginPageLayout.Canvas) {
    return PageLayoutType.Canvas;
  }

  return PageLayoutType.Standard;
}
