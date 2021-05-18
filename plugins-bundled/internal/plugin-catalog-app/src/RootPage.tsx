import { AppRootProps } from '@grafana/data';
import { pages } from 'pages';
import React from 'react';

export const MarketplaceRootPage = React.memo(function MarketplaceRootPage(props: AppRootProps) {
  const {
    path,
    query: { tab },
  } = props;
  // Required to support grafana instances that use a custom `root_url`.
  const pathWithoutLeadingSlash = path.replace(/^\//, '');

  const Page = pages.find(({ id }) => id === tab)?.component || pages[0].component;
  return <Page {...props} path={pathWithoutLeadingSlash} />;
});
