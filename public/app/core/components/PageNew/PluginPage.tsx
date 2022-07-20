import React from 'react';

import { PluginPageProps } from '@grafana/runtime';

import { Page } from '../Page/Page';

export function PluginPage({ children }: PluginPageProps) {
  return <Page navId="apps">{children}</Page>;
}
