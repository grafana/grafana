import React from 'react';
import { Page } from 'components/Page';
import { AppRootProps, NavModelItem } from '@grafana/data';

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
      To enabled installing plugins, set the{' '}
      <a href="https://grafana.com/docs/grafana/latest/plugins/catalog">Plugin Catalog</a> instructions
    </Page>
  );
};
