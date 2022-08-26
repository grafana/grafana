import React from 'react';

import { PluginPageProps } from '@grafana/runtime';

import { Page } from '../Page/Page';

export function PluginPage({ children, pageNav }: PluginPageProps) {
  return (
    <Page navId="apps" pageNav={pageNav}>
      {children}
    </Page>
  );
}
