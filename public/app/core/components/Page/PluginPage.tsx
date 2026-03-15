import { useContext } from 'react';

import { PluginPageProps } from '@grafana/runtime';
import { PluginPageContext } from 'app/features/plugins/components/PluginPageContext';

import { Page } from './Page';

export function PluginPage({
  actions,
  children,
  info,
  pageNav,
  layout,
  renderTitle,
  subTitle,
  background,
}: PluginPageProps) {
  const context = useContext(PluginPageContext);

  return (
    <Page
      navModel={context.sectionNav}
      pageNav={pageNav}
      layout={layout}
      actions={actions}
      renderTitle={renderTitle}
      info={info}
      subTitle={subTitle}
      background={background}
    >
      <Page.Contents>{children}</Page.Contents>
    </Page>
  );
}
