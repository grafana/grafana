import { ComponentClass } from 'react';

import { AppPlugin, AppPluginMeta, AppRootProps, PluginConfigPageProps } from '@grafana/data';
import { Settings } from './config/Settings';
import { MarketplaceRootPage } from './RootPage';
import { CatalogAppSettings } from './types';

export const plugin = new AppPlugin<CatalogAppSettings>()
  .setRootPage((MarketplaceRootPage as unknown) as ComponentClass<AppRootProps>)
  .addConfigPage({
    title: 'Settings',
    icon: 'info-circle',
    body: (Settings as unknown) as ComponentClass<PluginConfigPageProps<AppPluginMeta<CatalogAppSettings>>>,
    id: 'settings',
  });
