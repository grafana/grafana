import { AppRootProps } from '@grafana/data';
import { pages } from 'pages';
import React from 'react';
import { css } from 'emotion';

export const MarketplaceRootPage = React.memo(function MarketplaceRootPage(props: AppRootProps) {
  const {
    path,
    query: { tab },
  } = props;
  // Required to support grafana instances that use a custom `root_url`.
  const pathWithoutLeadingSlash = path.replace(/^\//, '');

  const Page = pages.find(({ id }) => id === tab)?.component || pages[0].component;
  return (
    <div
      className={css`
        margin-left: auto;
        margin-right: auto;
        max-width: 980px;
        padding: 48px 16px;
      `}
    >
      <Page {...props} path={pathWithoutLeadingSlash} />
    </div>
  );
});
