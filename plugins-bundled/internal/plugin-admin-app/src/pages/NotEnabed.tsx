import React from 'react';
import { Page } from 'components/Page';
import { AppRootProps, NavModelItem } from '@grafana/data';
import { css } from '@emotion/css';

export const NotEnabled = ({ onNavChanged }: AppRootProps) => {
  const node: NavModelItem = {
    id: 'not-found',
    text: 'The plugin catalog is not enabled',
    icon: 'exclamation-triangle',
    url: 'not-found',
  };
  onNavChanged({
    node: node,
    main: node,
  });

  return (
    <Page>
      To enable installing plugins, please refer to the{' '}
      <a
        className={css`
          text-decoration: underline;
        `}
        href="https://grafana.com/docs/grafana/latest/plugins/catalog"
      >
        Plugin Catalog
      </a>{' '}
      instructions
    </Page>
  );
};
