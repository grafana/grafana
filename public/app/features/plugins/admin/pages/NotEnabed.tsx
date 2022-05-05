import { css } from '@emotion/css';
import React from 'react';

import { NavModel, NavModelItem } from '@grafana/data';
import { Page } from 'app/core/components/Page/Page';

const node: NavModelItem = {
  id: 'not-found',
  text: 'The plugin catalog is not enabled',
  icon: 'exclamation-triangle',
  url: 'not-found',
};

const navModel: NavModel = { node, main: node };

export default function NotEnabled(): JSX.Element | null {
  return (
    <Page navModel={navModel}>
      <Page.Contents>
        To enable installing plugins via catalog, please refer to the{' '}
        <a
          className={css`
            text-decoration: underline;
          `}
          href="https://grafana.com/docs/grafana/latest/plugins/catalog"
        >
          Plugin Catalog
        </a>{' '}
        instructions
      </Page.Contents>
    </Page>
  );
}
